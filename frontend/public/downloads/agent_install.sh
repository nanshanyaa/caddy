#!/bin/bash
TOKEN=$1
API_URL=$2
CUSTOM_NAME=${3:-$(hostname)}
if [ -z "$API_URL" ]; then echo "Usage: bash agent_install.sh <TOKEN> <API_URL> [CUSTOM_NAME]"; exit 1; fi
mkdir -p /opt/caddy-agent
cd /opt/caddy-agent
cat > agent.py <<PYTHON_END
import time, os, socket, requests, psutil, docker, sys
HUB_API = os.getenv("HUB_API")
HUB_TOKEN = os.getenv("HUB_TOKEN")
HOSTNAME = os.getenv("HUB_NAME") or socket.gethostname()
AGENT_ID = f"agent_{HOSTNAME}"
if HUB_API.endswith('/'):
    HEARTBEAT_URL = f"{HUB_API}agent/heartbeat"
else:
    HEARTBEAT_URL = f"{HUB_API}/agent/heartbeat"
print(f"🚀 Agent Starting: {AGENT_ID}")

def get_public_ip():
    for url in ("https://ifconfig.me/ip", "https://api.ipify.org"):
        try:
            r = requests.get(url, timeout=5)
            if r.ok:
                return r.text.strip()
        except Exception:
            continue
    return ""

def self_destruct():
    try:
        try:
            if os.path.isdir("/opt/caddy-agent"):
                for root, dirs, files in os.walk("/opt/caddy-agent", topdown=False):
                    for name in files:
                        try:
                            os.remove(os.path.join(root, name))
                        except Exception:
                            pass
                    for name in dirs:
                        try:
                            os.rmdir(os.path.join(root, name))
                        except Exception:
                            pass
                try:
                    os.rmdir("/opt/caddy-agent")
                except Exception:
                    pass
        except Exception:
            pass
        client = docker.from_env()
        me = client.containers.get(socket.gethostname())
        me.stop()
        me.remove(force=True)
    except Exception:
        sys.exit(1)


def get_containers():
    try:
        client = docker.from_env()
        containers = []
        def extract_port(port_map):
            # Prefer the exposed host port, otherwise fall back to the container port without protocol suffix.
            if not port_map:
                return "N/A"
            for container_port, mappings in port_map.items():
                if mappings:
                    host_port = mappings[0].get("HostPort")
                    if host_port:
                        return host_port
                clean = container_port.split("/")[0]
                if clean:
                    return clean
            return "N/A"
        for c in client.containers.list():
            img = c.attrs['Config']['Image']
            simple_name = img.split(':')[0].split('/')[-1]
            containers.append({
                "id": c.short_id,
                "name": c.name,
                "image": img,
                "simple_name": simple_name,
                "status": c.status,
                "port": extract_port(c.ports),
            })
        return containers
    except Exception:
        return []


public_ip = get_public_ip()

while True:
    try:
        payload = {
            "id": AGENT_ID,
            "token": HUB_TOKEN,
            "hostname": HOSTNAME,
            "cpu_percent": psutil.cpu_percent(),
            "mem_percent": psutil.virtual_memory().percent,
            "containers": get_containers(),
            "public_ip": public_ip,
        }
        r = requests.post(HEARTBEAT_URL, json=payload, timeout=10)
        if r.json().get('status') == 'kill':
            self_destruct()
    except Exception:
        pass
    time.sleep(5)
PYTHON_END
cat > Dockerfile <<'DOCKER_END'
FROM python:3.9-slim
WORKDIR /app
RUN pip install docker psutil requests -i https://pypi.tuna.tsinghua.edu.cn/simple
COPY agent.py .
CMD ["python", "-u", "agent.py"]
DOCKER_END
docker build -t caddy-hub-agent . >/dev/null
docker rm -f caddy-hub-agent 2>/dev/null
docker run -d --name caddy-hub-agent --restart=always --network host -v /var/run/docker.sock:/var/run/docker.sock -v /opt/caddy-agent:/opt/caddy-agent -e HUB_API="$API_URL" -e HUB_TOKEN="$TOKEN" -e HUB_NAME="$CUSTOM_NAME" caddy-hub-agent
echo "✅ Agent Installed!"
