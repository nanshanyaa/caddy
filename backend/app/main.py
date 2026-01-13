from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import ipaddress
import json
import logging
import os
import time
import requests

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_FILE = "/data/db.json"
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("caddy-hub")
CF_API_BASE = "https://api.cloudflare.com/client/v4"
CF_API_TOKEN = os.getenv("CF_API_TOKEN", "").strip()
CF_ZONE_ID = os.getenv("CF_ZONE_ID", "").strip()
CF_ZONE_NAME = os.getenv("CF_ZONE_NAME", "").strip()
CF_RECORD_TYPE = os.getenv("CF_RECORD_TYPE", "A").strip().upper()
CF_DNS_PROXY = os.getenv("CF_DNS_PROXY", "false").strip().lower() in ("1", "true", "yes", "on")
CF_DNS_DELETE = os.getenv("CF_DNS_DELETE", "true").strip().lower() in ("1", "true", "yes", "on")
CF_CNAME_TARGET = os.getenv("CF_CNAME_TARGET", "").strip()
_cf_zone_id_cache = None


class Database:
    def __init__(self):
        self.servers = []
        self.upstreams = {}
        self.sites = []
        self.killed_agents = []
        self.custom_icons = {}
        self.container_meta = {}
        self.dirty = False
        self.last_save = 0.0
        self.settings = {
            "defaultApiPort": "2019",
            "agentToken": "sk_live_" + str(int(time.time())),
            "autoHttps": True,
            "customLogoUrl": "",
            "customBgUrl": "",
        }
        self.load()

    def load(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r") as f:
                    data = json.load(f)
                    self.servers = data.get("servers", [])
                    self.sites = data.get("sites", [])
                    self.upstreams = data.get("upstreams", {})
                    self.killed_agents = data.get("killed_agents", [])
                    self.custom_icons = data.get("custom_icons", {})
                    self.container_meta = data.get("container_meta", {})
                    saved = data.get("settings", {})
                    if saved:
                        self.settings.update(saved)
            except Exception:
                logger.exception("Failed to load state from %s", DATA_FILE)

    def mark_dirty(self):
        self.dirty = True

    def save(self, force: bool = False, min_interval: int = 5):
        now = time.time()
        if not force:
            if not self.dirty:
                return
            if now - self.last_save < min_interval:
                return
        try:
            with open(DATA_FILE, "w") as f:
                json.dump(
                    {
                        "servers": self.servers,
                        "sites": self.sites,
                        "upstreams": self.upstreams,
                        "killed_agents": self.killed_agents,
                        "custom_icons": self.custom_icons,
                        "container_meta": self.container_meta,
                        "settings": self.settings,
                    },
                    f,
                    indent=2,
                )
            self.dirty = False
            self.last_save = now
        except Exception:
            logger.exception("Failed to save state to %s", DATA_FILE)


db = Database()


def clean_target(target: str) -> str:
    """Strip protocol suffixes from port values and validate the target string."""
    if not target or ":" not in target:
        return ""
    host, port = target.rsplit(":", 1)
    clean_port = str(port).split("/")[0].strip()
    if not clean_port.isdigit():
        return ""
    return f"{host}:{clean_port}"


def normalize_port(port: str, fallback: str = "2019") -> str:
    """Allow only numeric ports, fallback to default."""
    if not port:
        return fallback
    p = str(port).split("/")[0].strip()
    return p if p.isdigit() else fallback


def is_private_ip(value: str) -> bool:
    try:
        ip = ipaddress.ip_address(value)
        return ip.is_private or ip.is_loopback or ip.is_link_local
    except ValueError:
        return False


def cleanup_killed_agents():
    now = time.time()
    db.killed_agents = [k for k in db.killed_agents if k.get("expires", 0) > now]


def is_kill_pending(agent_id: str) -> bool:
    cleanup_killed_agents()
    return any(k.get("id") == agent_id for k in db.killed_agents)


def push_caddy_rule(server_ip, site_id, domain, target, api_port="2019"):
    caddy_url = f"http://{server_ip}:{api_port}/config/apps/http/servers/srv0/routes"
    payload = {
        "@id": str(site_id),
        "match": [{"host": [domain]}],
        "handle": [
            {
                "handler": "reverse_proxy",
                "upstreams": [{"dial": target}],
            }
        ],
    }
    def ensure_http_server():
        base_url = f"http://{server_ip}:{api_port}/config/apps/http"
        server_payload = {"servers": {"srv0": {"listen": [":80", ":443"], "routes": []}}}
        try:
            r = requests.get(f"{base_url}/servers/srv0", timeout=3)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        try:
            r = requests.put(base_url, json=server_payload, timeout=5)
            return r.status_code in (200, 201)
        except Exception:
            return False

    try:
        r = requests.post(caddy_url, json=payload, timeout=5)
        if r.status_code == 200:
            return True, ""
        if r.status_code in (404, 500) and "invalid traversal path" in r.text:
            if ensure_http_server():
                r = requests.post(caddy_url, json=payload, timeout=5)
                if r.status_code == 200:
                    return True, ""
        msg = f"Caddy HTTP {r.status_code}: {r.text}"
        logger.warning("[push_caddy_rule] failed: %s", msg)
        return False, msg
    except Exception as e:
        msg = f"Error contacting Caddy: {e}"
        logger.exception("[push_caddy_rule] exception: %s", msg)
        return False, msg


def delete_caddy_rule(server_ip, site_id, api_port="2019"):
    caddy_url = f"http://{server_ip}:{api_port}/id/{site_id}"
    try:
        requests.delete(caddy_url, timeout=5)
        return True
    except Exception:
        logger.exception("[delete_caddy_rule] failed: %s", caddy_url)
        return False


def _cf_headers():
    return {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "application/json",
    }


def _cf_record_ttl():
    raw = os.getenv("CF_RECORD_TTL", "1").strip()
    try:
        ttl = int(raw)
    except ValueError:
        return 1
    return ttl if ttl > 0 else 1


def _cf_content_for_record(record_type: str, server_ip: str):
    if record_type == "A":
        try:
            return str(ipaddress.IPv4Address(server_ip))
        except Exception:
            return ""
    if record_type == "AAAA":
        try:
            return str(ipaddress.IPv6Address(server_ip))
        except Exception:
            return ""
    if record_type == "CNAME":
        return CF_CNAME_TARGET
    return ""


def _cf_record_name(base_domain: str, prefix: str):
    base = (base_domain or "").strip().strip(".")
    if not base:
        return ""
    return f"{prefix}.{base}" if prefix else base


def _cf_list_record(zone_id: str, record_type: str, name: str):
    r = requests.get(
        f"{CF_API_BASE}/zones/{zone_id}/dns_records",
        headers=_cf_headers(),
        params={"type": record_type, "name": name},
        timeout=5,
    )
    if r.status_code != 200:
        return None, f"CF list failed {r.status_code}"
    result = (r.json() or {}).get("result", [])
    return result, ""


def _get_cf_zone_id():
    global _cf_zone_id_cache
    if CF_ZONE_ID:
        return CF_ZONE_ID
    if _cf_zone_id_cache:
        return _cf_zone_id_cache
    if not CF_ZONE_NAME:
        return ""
    try:
        r = requests.get(
            f"{CF_API_BASE}/zones",
            headers=_cf_headers(),
            params={"name": CF_ZONE_NAME, "status": "active"},
            timeout=5,
        )
        if r.status_code == 200:
            result = (r.json() or {}).get("result", [])
            if result:
                _cf_zone_id_cache = result[0].get("id", "")
                return _cf_zone_id_cache or ""
        logger.warning("CF zone lookup failed: %s %s", r.status_code, r.text)
    except Exception:
        logger.exception("CF zone lookup error")
    return ""


def ensure_cf_dns(domain: str, ip: str):
    if not CF_API_TOKEN:
        return False, "CF token missing"
    zone_id = _get_cf_zone_id()
    if not zone_id:
        return False, "CF zone not found"
    if CF_ZONE_NAME and not domain.endswith(CF_ZONE_NAME):
        return False, "Domain not in zone"
    record_type = CF_RECORD_TYPE or "A"
    content = _cf_content_for_record(record_type, ip)
    if not content:
        return False, f"Invalid content for record type {record_type}"
    payload = {
        "type": record_type,
        "name": domain,
        "content": content,
        "ttl": _cf_record_ttl(),
        "proxied": CF_DNS_PROXY,
    }
    try:
        result, msg = _cf_list_record(zone_id, record_type, domain)
        if result is None:
            return False, msg
        if result:
            record_id = result[0].get("id")
            r = requests.put(
                f"{CF_API_BASE}/zones/{zone_id}/dns_records/{record_id}",
                headers=_cf_headers(),
                json=payload,
                timeout=5,
            )
        else:
            r = requests.post(
                f"{CF_API_BASE}/zones/{zone_id}/dns_records",
                headers=_cf_headers(),
                json=payload,
                timeout=5,
            )
        if r.status_code in (200, 201):
            return True, ""
        return False, f"CF write failed {r.status_code}"
    except Exception as e:
        logger.exception("CF DNS update error: %s", e)
        return False, "CF exception"


def delete_cf_dns(domain: str):
    if not CF_API_TOKEN:
        return False, "CF token missing"
    zone_id = _get_cf_zone_id()
    if not zone_id:
        return False, "CF zone not found"
    if CF_ZONE_NAME and not domain.endswith(CF_ZONE_NAME):
        return False, "Domain not in zone"
    record_type = CF_RECORD_TYPE or "A"
    try:
        result, msg = _cf_list_record(zone_id, record_type, domain)
        if result is None:
            return False, msg
        if not result:
            return True, ""
        record_id = result[0].get("id")
        r = requests.delete(
            f"{CF_API_BASE}/zones/{zone_id}/dns_records/{record_id}",
            headers=_cf_headers(),
            timeout=5,
        )
        if r.status_code in (200, 204):
            return True, ""
        return False, f"CF delete failed {r.status_code}"
    except Exception as e:
        logger.exception("CF DNS delete error: %s", e)
        return False, "CF exception"


def _cf_upsert_txt(name: str, content: str):
    zone_id = _get_cf_zone_id()
    if not zone_id:
        return False, "CF zone not found"
    payload = {
        "type": "TXT",
        "name": name,
        "content": content,
        "ttl": _cf_record_ttl(),
        "proxied": False,
    }
    result, msg = _cf_list_record(zone_id, "TXT", name)
    if result is None:
        return False, msg
    if result:
        record_id = result[0].get("id")
        r = requests.put(
            f"{CF_API_BASE}/zones/{zone_id}/dns_records/{record_id}",
            headers=_cf_headers(),
            json=payload,
            timeout=5,
        )
    else:
        r = requests.post(
            f"{CF_API_BASE}/zones/{zone_id}/dns_records",
            headers=_cf_headers(),
            json=payload,
            timeout=5,
        )
    if r.status_code in (200, 201):
        return True, ""
    return False, f"CF write failed {r.status_code}"


def _cf_delete_txt(name: str):
    zone_id = _get_cf_zone_id()
    if not zone_id:
        return False, "CF zone not found"
    result, msg = _cf_list_record(zone_id, "TXT", name)
    if result is None:
        return False, msg
    if not result:
        return True, ""
    record_id = result[0].get("id")
    r = requests.delete(
        f"{CF_API_BASE}/zones/{zone_id}/dns_records/{record_id}",
        headers=_cf_headers(),
        timeout=5,
    )
    if r.status_code in (200, 204):
        return True, ""
    return False, f"CF delete failed {r.status_code}"


def maybe_update_dns(domain: str, server_ip: str):
    if not domain or not server_ip:
        return
    ok, msg = ensure_cf_dns(domain, server_ip)
    if not ok:
        logger.warning("CF DNS not updated for %s -> %s: %s", domain, server_ip, msg)


def maybe_delete_dns(domain: str):
    if not CF_DNS_DELETE:
        return
    if not domain:
        return
    ok, msg = delete_cf_dns(domain)
    if not ok:
        logger.warning("CF DNS not deleted for %s: %s", domain, msg)


@app.get("/api/state")
def get_state():
    upstream_list = list(db.upstreams.values())
    all_containers = []
    now = time.time()
    for u in upstream_list:
        if now - u.get("last_seen", 0) > 30:
            u["status"] = "offline"
        else:
            u["status"] = "online"
        if "containers" in u:
            for c in u["containers"]:
                c["upstreamId"] = u["id"]
                if u["status"] == "offline":
                    c["status"] = "unreachable"
                c["customIcon"] = db.custom_icons.get(c["name"], "")
                meta = db.container_meta.get(c["name"], {})
                c["hidden"] = bool(meta.get("hidden", False))
                c["displayName"] = meta.get("alias") or c["name"]
                c["note"] = meta.get("note", "")
                all_containers.append(c)
    return {
        "servers": db.servers,
        "upstreams": upstream_list,
        "containers": all_containers,
        "sites": db.sites,
        "settings": db.settings,
    }


class IconUpdate(BaseModel):
    containerName: str
    iconUrl: str


@app.post("/api/containers/icon")
def update_container_icon(data: IconUpdate):
    db.custom_icons[data.containerName] = data.iconUrl
    db.mark_dirty()
    db.save(force=True)
    return {"status": "ok"}


class ContainerMetaUpdate(BaseModel):
    containerName: str
    hidden: Optional[bool] = None
    alias: Optional[str] = None
    note: Optional[str] = None


@app.post("/api/containers/meta")
def update_container_meta(data: ContainerMetaUpdate):
    meta = db.container_meta.get(data.containerName, {})
    if data.hidden is not None:
        meta["hidden"] = data.hidden
    if data.alias is not None:
        meta["alias"] = data.alias
    if data.note is not None:
        meta["note"] = data.note
    db.container_meta[data.containerName] = meta
    db.mark_dirty()
    db.save(force=True)
    return {"status": "ok", "meta": meta}


class SettingsModel(BaseModel):
    agentToken: str
    defaultApiPort: str
    autoHttps: bool
    customLogoUrl: str = ""
    customBgUrl: str = ""


class SiteUpdate(BaseModel):
    domain: str
    target: str
    https: Optional[bool] = None
    note: Optional[str] = None


class SiteCreate(BaseModel):
    serverId: int
    domain: str
    target: str
    https: Optional[bool] = True
    note: Optional[str] = None


class CfTestPayload(BaseModel):
    domain: Optional[str] = None


@app.post("/api/settings/update")
def update_settings(s: SettingsModel):
    db.settings["agentToken"] = s.agentToken
    db.settings["defaultApiPort"] = s.defaultApiPort
    db.settings["autoHttps"] = s.autoHttps
    db.settings["customLogoUrl"] = s.customLogoUrl
    db.settings["customBgUrl"] = s.customBgUrl
    db.mark_dirty()
    db.save(force=True)
    return {"status": "ok", "settings": db.settings}


@app.post("/api/cf/test")
def test_cf_dns(payload: CfTestPayload):
    if not CF_API_TOKEN:
        return {"status": "error", "msg": "CF token missing"}
    base_domain = payload.domain or CF_ZONE_NAME
    if not base_domain:
        return {"status": "error", "msg": "Domain missing"}
    if CF_ZONE_NAME and not base_domain.endswith(CF_ZONE_NAME):
        return {"status": "error", "msg": "Domain not in zone"}
    test_name = _cf_record_name(base_domain, "_caddyhub_test")
    if not test_name:
        return {"status": "error", "msg": "Invalid test domain"}
    try:
        content = f"caddyhub-test-{int(time.time())}"
        ok, msg = _cf_upsert_txt(test_name, content)
        if not ok:
            return {"status": "error", "msg": msg or "CF test write failed"}
        ok, msg = _cf_delete_txt(test_name)
        if not ok:
            return {"status": "error", "msg": msg or "CF test delete failed"}
        return {"status": "ok"}
    except Exception:
        logger.exception("CF test failed")
        return {"status": "error", "msg": "CF test exception"}


@app.post("/api/servers/register")
async def register_server(request: Request):
    data = await request.json()
    ip = data.get("ip") or data.get("public_ip") or request.client.host
    name = data.get("name", f"Node-{ip}")
    api_port = normalize_port(
        data.get("apiPort", db.settings.get("defaultApiPort", "2019")), "2019"
    )
    existing = next((s for s in db.servers if s["ip"] == ip), None)
    if existing:
        existing["status"] = "online"
        existing["last_seen"] = time.time()
        existing["name"] = name
        existing["apiPort"] = api_port
    else:
        db.servers.append(
            {
                "id": int(time.time() * 1000),
                "name": name,
                "ip": ip,
                "apiPort": api_port,
                "status": "online",
                "flag": "🟢",
            }
        )
    db.mark_dirty()
    db.save(force=True)
    return {"status": "ok"}


@app.delete("/api/servers/{sid}")
def del_server(sid: int):
    db.servers = [s for s in db.servers if s["id"] != sid]
    db.sites = [s for s in db.sites if s["serverId"] != sid]
    db.mark_dirty()
    db.save(force=True)
    return {"ok": True}


@app.delete("/api/upstreams/{uid}")
def del_upstream(uid: str):
    if uid in db.upstreams:
        del db.upstreams[uid]
    if not is_kill_pending(uid):
        db.killed_agents.append({"id": uid, "expires": time.time() + 600})
    db.mark_dirty()
    db.save(force=True)
    return {"ok": True}


@app.post("/api/agent/heartbeat")
async def heartbeat(request: Request):
    data = await request.json()
    aid = data.get("id")
    token = data.get("token")
    if is_kill_pending(aid):
        return {"status": "kill", "msg": "Terminated."}
    if token != db.settings["agentToken"]:
        if db.settings["agentToken"]:
            return {"status": "error", "msg": "Invalid Token"}
    new_upstream = {
        "id": aid,
        "name": data.get("hostname"),
        "ip": request.client.host,
        "public_ip": data.get("public_ip", ""),
        "status": "online",
        "cpu": data.get("cpu_percent", 0),
        "mem": data.get("mem_percent", 0),
        "containers": data.get("containers", []),
        "last_seen": time.time(),
    }
    existing = db.upstreams.get(aid)
    db.upstreams[aid] = new_upstream
    if not existing or strip_ephemeral_upstream(existing) != strip_ephemeral_upstream(new_upstream):
        db.mark_dirty()
    db.save(force=False, min_interval=30)
    return {"status": "ok"}


@app.post("/api/deploy")
async def deploy(request: Request):
    data = await request.json()
    server = next((s for s in db.servers if s["id"] == data["serverId"]), None)
    if not server:
        return {"status": "error", "msg": "Server not found"}
    api_port = normalize_port(
        data.get(
            "apiPort",
            server.get("apiPort", db.settings.get("defaultApiPort", "2019")),
        ),
        "2019",
    )
    target = clean_target(data.get("target", ""))
    if not target:
        return {"status": "error", "msg": "Invalid target port"}
    host, port = target.rsplit(":", 1)
    upstream = db.upstreams.get(data.get("upstreamId"))
    public_ip = (upstream or {}).get("public_ip", "").strip()
    if public_ip and (host == (upstream or {}).get("ip") or is_private_ip(host)):
        host = public_ip
    data["target"] = f"{host}:{port}"
    target = data["target"]
    site_id = int(time.time() * 1000)
    data["id"] = site_id
    data["status"] = "active"
    data["note"] = data.get("note", "")
    ok, msg = push_caddy_rule(server["ip"], site_id, data["domain"], target, api_port)
    if ok:
        db.sites.append(data)
        db.mark_dirty()
        db.save(force=True)
        maybe_update_dns(data.get("domain", ""), server.get("ip", ""))
        return data
    return {"status": "error", "msg": msg or "Failed to configure remote Caddy"}


@app.delete("/api/sites/{sid}")
def del_site(sid: int):
    site = next((s for s in db.sites if s["id"] == sid), None)
    if site:
        server = next((s for s in db.servers if s["id"] == site["serverId"]), None)
        if server:
            api_port = normalize_port(server.get("apiPort") or db.settings.get("defaultApiPort"), "2019")
            delete_caddy_rule(server["ip"], sid, api_port)
        maybe_delete_dns(site.get("domain", ""))
    db.sites = [s for s in db.sites if s["id"] != sid]
    db.mark_dirty()
    db.save(force=True)
    return {"ok": True}


@app.post("/api/sites/manual")
def create_site(payload: SiteCreate):
    server = next((s for s in db.servers if s["id"] == payload.serverId), None)
    if not server:
        return {"status": "error", "msg": "Server not found"}
    api_port = normalize_port(server.get("apiPort") or db.settings.get("defaultApiPort"), "2019")
    target = clean_target(payload.target)
    if not target:
        return {"status": "error", "msg": "Invalid target port"}
    domain = payload.domain.strip()
    if not domain:
        return {"status": "error", "msg": "Invalid domain"}
    site_id = int(time.time() * 1000)
    site = {
        "id": site_id,
        "serverId": payload.serverId,
        "domain": domain,
        "target": target,
        "https": bool(payload.https),
        "status": "active",
        "note": payload.note or "",
    }
    ok, msg = push_caddy_rule(server["ip"], site_id, domain, target, api_port)
    if not ok:
        return {"status": "error", "msg": msg or "Failed to configure remote Caddy"}
    db.sites.append(site)
    db.mark_dirty()
    db.save(force=True)
    maybe_update_dns(domain, server.get("ip", ""))
    return {"status": "ok", "site": site}


@app.put("/api/sites/{sid}")
def update_site(sid: int, payload: SiteUpdate):
    site = next((s for s in db.sites if s["id"] == sid), None)
    if not site:
        return {"status": "error", "msg": "Site not found"}
    server = next((s for s in db.servers if s["id"] == site["serverId"]), None)
    if not server:
        return {"status": "error", "msg": "Server not found"}
    api_port = normalize_port(server.get("apiPort") or db.settings.get("defaultApiPort"), "2019")
    target = clean_target(payload.target)
    if not target:
        return {"status": "error", "msg": "Invalid target port"}
    host, port = target.rsplit(":", 1)
    upstream = db.upstreams.get(site.get("upstreamId"))
    public_ip = (upstream or {}).get("public_ip", "").strip()
    if public_ip and (host == (upstream or {}).get("ip") or is_private_ip(host)):
        host = public_ip
    new_target = f"{host}:{port}"
    new_domain = payload.domain.strip()
    if not new_domain:
        return {"status": "error", "msg": "Invalid domain"}
    old_domain = site.get("domain")
    old_target = site.get("target")
    old_https = site.get("https")
    if not delete_caddy_rule(server["ip"], sid, api_port):
        return {"status": "error", "msg": "Failed to remove old rule"}
    ok, msg = push_caddy_rule(server["ip"], sid, new_domain, new_target, api_port)
    if not ok:
        # Best-effort rollback.
        if old_domain and old_target:
            push_caddy_rule(server["ip"], sid, old_domain, old_target, api_port)
        return {"status": "error", "msg": msg or "Failed to update rule"}
    site["domain"] = new_domain
    site["target"] = new_target
    if payload.https is not None:
        site["https"] = payload.https
    else:
        site["https"] = old_https
    if payload.note is not None:
        site["note"] = payload.note
    db.mark_dirty()
    db.save(force=True)
    if old_domain and old_domain != new_domain:
        maybe_delete_dns(old_domain)
    maybe_update_dns(new_domain, server.get("ip", ""))
    return {"status": "ok", "site": site}


def strip_ephemeral_upstream(upstream: dict) -> dict:
    return {
        k: v
        for k, v in upstream.items()
        if k not in ("last_seen", "status")
    }
