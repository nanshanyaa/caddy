import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Settings,
  X,
  Database,
  Globe,
  Shield,
  Eye,
  LayoutGrid,
  Trash2,
  Image as ImageIcon,
  Pencil,
  Plus,
  Copy,
  Terminal,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function CaddyManager() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [activeView, setActiveView] = useState('dashboard');
  const [selectedServer, setSelectedServer] = useState(null);
  const [selectedUpstream, setSelectedUpstream] = useState(null);
  const [servers, setServers] = useState([]);
  const [upstreams, setUpstreams] = useState([]);
  const [sites, setSites] = useState([]);
  const [containers, setContainers] = useState([]);
  const [settings, setSettings] = useState({
    agentToken: '',
    defaultApiPort: '2019',
    autoHttps: true,
    customLogoUrl: '',
    customBgUrl: ''
  });
  const [caddyNameInput, setCaddyNameInput] = useState('');
  const [agentNameInput, setAgentNameInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [logoInput, setLogoInput] = useState('');
  const [bgInput, setBgInput] = useState('');
  const [cfTestDomain, setCfTestDomain] = useState('');
  const [isTestingCf, setIsTestingCf] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [deployTarget, setDeployTarget] = useState(null);
  const [iconEditTarget, setIconEditTarget] = useState(null);
  const [isAddLineModalOpen, setIsAddLineModalOpen] = useState(false);
  const [isAddSourceModalOpen, setIsAddSourceModalOpen] = useState(false);
  const [siteEditTarget, setSiteEditTarget] = useState(null);
  const [manualSiteServer, setManualSiteServer] = useState(null);
  const [containerEditTarget, setContainerEditTarget] = useState(null);
  const [showHiddenContainers, setShowHiddenContainers] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [isServersCollapsed, setIsServersCollapsed] = useState(false);
  const [isUpstreamsCollapsed, setIsUpstreamsCollapsed] = useState(false);
  const isEditingRef = useRef(false);
  const isFetchingRef = useRef(false);

  const filteredServers = useMemo(() => {
    const query = sidebarQuery.trim().toLowerCase();
    if (!query) return servers;
    return servers.filter((server) => {
      const name = (server.name || '').toLowerCase();
      const ip = (server.ip || '').toLowerCase();
      return name.includes(query) || ip.includes(query);
    });
  }, [sidebarQuery, servers]);

  const filteredUpstreams = useMemo(() => {
    const query = sidebarQuery.trim().toLowerCase();
    if (!query) return upstreams;
    return upstreams.filter((upstream) => {
      const name = (upstream.name || '').toLowerCase();
      const ip = (upstream.ip || '').toLowerCase();
      const publicIp = (upstream.public_ip || '').toLowerCase();
      return name.includes(query) || ip.includes(query) || publicIp.includes(query);
    });
  }, [sidebarQuery, upstreams]);

  useEffect(() => {
    fetchState(true);
    const timer = setInterval(() => fetchState(false), 5000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeView !== 'settings') isEditingRef.current = false;
  }, [activeView]);

  const fetchState = async (isFirstLoad) => {
    if (document.hidden && !isFirstLoad) return;
    if (isFetchingRef.current && !isFirstLoad) return;
    isFetchingRef.current = true;
    try {
      const res = await fetch('/api/state');
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
        setUpstreams(data.upstreams || []);
        setSites(data.sites || []);
        setContainers(data.containers || []);
        if (data.settings) {
          setSettings(data.settings);
          if (isFirstLoad || (!isEditingRef.current && activeView !== 'settings')) {
            setTokenInput(data.settings.agentToken);
            setLogoInput(data.settings.customLogoUrl || '');
            setBgInput(data.settings.customBgUrl || '');
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      isFetchingRef.current = false;
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    const newSettings = {
      ...settings,
      agentToken: tokenInput,
      customLogoUrl: logoInput,
      customBgUrl: bgInput
    };
    try {
      await fetch('/api/settings/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      setSettings(newSettings);
      isEditingRef.current = false;
      alert('✅ 设置已保存！');
    } catch (e) {
      alert('❌ 保存失败');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleCfTest = async () => {
    if (isTestingCf) return;
    setIsTestingCf(true);
    try {
      const res = await fetch('/api/cf/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: cfTestDomain.trim() })
      });
      const json = await res.json();
      if (json.status === 'ok') {
        alert('✅ Cloudflare DNS 写入/删除测试成功');
      } else {
        alert('❌ 测试失败: ' + (json.msg || '未知错误'));
      }
    } catch (e) {
      alert('❌ 测试失败');
    } finally {
      setIsTestingCf(false);
    }
  };

  const handleDeploy = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const rawPort = deployTarget?.container?.port || '';
    const cleanPort = rawPort.includes('/') ? rawPort.split('/')[0] : rawPort;
    if (!cleanPort || cleanPort === 'N/A') {
      alert('❌ 未找到容器端口，无法发布');
      return;
    }
    const payload = {
      serverId: parseInt(formData.get('serverId')),
      upstreamId: deployTarget.upstream.id,
      containerId: deployTarget.container.id,
      domain: formData.get('domain'),
      target: `${deployTarget.upstream.ip}:${cleanPort}`,
      https: true
    };
    const res = await fetch('/api/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.status === 'error') {
      alert('❌ 发布失败: ' + json.msg);
    } else {
      setDeployTarget(null);
      fetchState(false);
    }
  };

  const handleUpdateIcon = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    await fetch('/api/containers/icon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        containerName: iconEditTarget.name,
        iconUrl: formData.get('iconUrl')
      })
    });
    setIconEditTarget(null);
    fetchState(false);
  };

  const handleUpdateContainerMeta = async (payload) => {
    await fetch('/api/containers/meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    fetchState(false);
  };

  const handleEditContainer = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const aliasRaw = (formData.get('alias') || '').trim();
    await handleUpdateContainerMeta({
      containerName: containerEditTarget.name,
      alias: aliasRaw,
      note: (formData.get('note') || '').trim(),
      hidden: formData.get('hidden') === 'on'
    });
    setContainerEditTarget(null);
  };

  const handleDeleteSite = async (sid) => {
    if (confirm('确定下线？')) {
      await fetch('/api/sites/' + sid, { method: 'DELETE' });
      fetchState(false);
    }
  };

  const handleUpdateSite = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      domain: formData.get('domain'),
      target: formData.get('target'),
      https: formData.get('https') === 'on',
      note: formData.get('note') || ''
    };
    const res = await fetch('/api/sites/' + siteEditTarget.id, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.status === 'error') {
      alert('❌ 修改失败: ' + json.msg);
      return;
    }
    setSiteEditTarget(null);
    fetchState(false);
  };

  const handleCreateManualSite = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      serverId: manualSiteServer.id,
      domain: formData.get('domain'),
      target: formData.get('target'),
      https: formData.get('https') === 'on',
      note: formData.get('note') || ''
    };
    const res = await fetch('/api/sites/manual', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (json.status === 'error') {
      alert('❌ 添加失败: ' + json.msg);
      return;
    }
    setManualSiteServer(null);
    fetchState(false);
  };

  const handleDeleteUpstream = async (uid) => {
    if (confirm('⚠️ 删除将触发自毁，确定？')) {
      await fetch('/api/upstreams/' + uid, { method: 'DELETE' });
      if (selectedUpstream?.id === uid) {
        setSelectedUpstream(null);
        setActiveView('dashboard');
      }
      fetchState(false);
    }
  };

  const handleDeleteServer = async (sid) => {
    if (confirm('确定删除此线路？')) {
      await fetch('/api/servers/' + sid, { method: 'DELETE' });
      if (selectedServer?.id === sid) {
        setSelectedServer(null);
        setActiveView('dashboard');
      }
      fetchState(false);
    }
  };

  const getCmd = (type) => {
    const host = window.location.hostname;
    const port = window.location.port ? ':' + window.location.port : '';
    const script = type === 'caddy' ? 'caddy_install.sh' : 'agent_install.sh';
    const customName = type === 'caddy' ? caddyNameInput : agentNameInput;
    const nameArg = customName ? ` ${customName}` : '';
    return `curl -sSL http://${host}${port}/downloads/${script} | bash -s ${settings.agentToken} http://${host}${port}/api${nameArg}`;
  };

  const copyCmd = (txt) => {
    navigator.clipboard.writeText(txt);
    alert('📋 指令已复制！');
  };

  const SmartIcon = ({ container, className }) => {
    if (container.customIcon) {
      return (
        <img src={container.customIcon} className={`${className} object-contain`} alt={container.name} />
      );
    }
    const iconUrl = `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/png/${container.simple_name}.png`;
    return (
      <img
        src={iconUrl}
        className={`${className} object-contain`}
        onError={(e) => {
          e.target.style.display = 'none';
          e.target.nextSibling.style.display = 'flex';
        }}
        alt={container.name}
      />
    );
  };

  const FallbackIcon = ({ className }) => (
    <div
      className={`${className} bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 hidden`}
    >
      <LayoutGrid size={24} />
    </div>
  );

  const getPublicAddress = (upstream, port) => {
    if (!port || port === 'N/A') return '';
    const cleanPort = port.includes('/') ? port.split('/')[0] : port;
    const ip = upstream.public_ip || upstream.ip || '';
    if (!ip) return '';
    return `${ip}:${cleanPort}`;
  };

  const getSiteForContainer = (containerId) => sites.find((s) => s.containerId === containerId);

  return (
    <div className={`${isDarkMode ? 'dark' : ''} h-screen flex overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100`}>
      <div className="ambient-bg"></div>
      <div className="ambient-orb orb-1"></div>
      <div className="ambient-orb orb-2"></div>
      <div className="ambient-orb orb-3"></div>
      {settings.customBgUrl && (
        <div
          className="absolute inset-0 z-0 opacity-10 dark:opacity-20 pointer-events-none"
          style={{
            backgroundImage: `url('${settings.customBgUrl}')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'blur(4px)'
          }}
        ></div>
      )}

      <aside className="w-[288px] bg-gradient-to-b from-white/95 via-white/90 to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-2xl min-h-0">
        <div className="h-20 px-6 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/70">
          {settings.customLogoUrl ? (
            <img src={settings.customLogoUrl} className="h-10 w-auto object-contain max-w-[200px]" alt="Logo" />
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #2b5bff 0%, #14b8a6 100%)' }}>
                <Sparkles size={20} />
              </div>
              <div className="leading-tight">
                <div className="font-display text-xl tracking-tight text-slate-900 dark:text-white">Caddy Hub</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Control Plane</div>
              </div>
            </div>
          )}
          <button
            onClick={toggleDarkMode}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
          >
            {isDarkMode ? 'Light' : 'Dark'}
          </button>
        </div>

        <div className="px-4 pt-4">
          <div className="rounded-2xl p-3 bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 shadow-sm">
            <button
              onClick={() => setActiveView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeView === 'dashboard'
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <LayoutGrid size={18} /> 概览仪表盘
            </button>
            <button
              onClick={() => {
                setActiveView('settings');
                isEditingRef.current = true;
              }}
              className={`w-full mt-2 flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeView === 'settings'
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/60'
              }`}
            >
              <Settings size={18} /> 系统设置
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 space-y-5 scrollbar-hide overscroll-contain">
          <div className="rounded-2xl bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 px-4 py-3">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-2">快速筛选</div>
            <input
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              placeholder="搜索线路 / 源站 / IP"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/80 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsServersCollapsed(!isServersCollapsed)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {isServersCollapsed ? '▸' : '▾'}
                </button>
                <span>公网线路</span>
                <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                  {filteredServers.length}
                </span>
              </div>
              <button
                onClick={() => setIsAddLineModalOpen(true)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Plus size={14} />
              </button>
            </div>
            {!isServersCollapsed && (
              <div className="px-2 pb-2 space-y-1">
                {filteredServers.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">暂无线路</div>
                )}
                {filteredServers.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setSelectedServer(s);
                    setActiveView('server_detail');
                  }}
                  className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all border border-transparent ${
                    selectedServer?.id === s.id && activeView === 'server_detail'
                      ? 'bg-white/95 dark:bg-slate-800/90 shadow-sm ring-1 ring-indigo-200/70 dark:ring-indigo-500/20 text-indigo-600'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <span className="text-sm leading-none">{s.flag}</span>
                    <span className="truncate font-medium">{s.name}</span>
                  </div>
                  <span
                    className={`relative inline-flex rounded-full h-1.5 w-1.5 ring-2 ring-white/70 dark:ring-slate-900/80 ${
                      s.status === 'online' ? 'bg-green-500' : 'bg-red-400'
                    }`}
                  ></span>
                </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white/85 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsUpstreamsCollapsed(!isUpstreamsCollapsed)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {isUpstreamsCollapsed ? '▸' : '▾'}
                </button>
                <span>内网源站</span>
                <span className="text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                  {filteredUpstreams.length}
                </span>
              </div>
              <button
                onClick={() => setIsAddSourceModalOpen(true)}
                className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Plus size={14} />
              </button>
            </div>
            {!isUpstreamsCollapsed && (
              <div className="px-2 pb-2 space-y-1">
                {filteredUpstreams.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 italic">暂无源站</div>
                )}
                {filteredUpstreams.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setSelectedUpstream(u);
                    setActiveView('upstream_detail');
                  }}
                  className={`w-full group flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all border border-transparent ${
                    selectedUpstream?.id === u.id && activeView === 'upstream_detail'
                      ? 'bg-white/95 dark:bg-slate-800/90 shadow-sm ring-1 ring-indigo-200/70 dark:ring-indigo-500/20 text-indigo-600'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    <Database size={16} />
                    <span className="truncate font-medium">{u.name}</span>
                  </div>
                  <div className={`w-1.5 h-1.5 rounded-full ring-2 ring-white/70 dark:ring-slate-900/80 ${u.status === 'online' ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-5 py-4 border-t border-slate-200/70 dark:border-slate-800/80 bg-white/90 dark:bg-slate-900/95">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span className="font-semibold tracking-wide">Caddy Hub v1.2</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Stable</span>
          </div>
        </div>
      </aside>

      <main className="flex-1 min-h-0 overflow-y-auto p-10 relative z-10">
        {activeView === 'dashboard' && (
          <div className="max-w-7xl mx-auto space-y-8 fade-in-up">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Caddy Hub</div>
                <h1 className="text-4xl font-display text-slate-900 dark:text-white">概览仪表盘</h1>
              </div>
              <button
                onClick={toggleDarkMode}
                className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 shadow-sm"
              >
                {isDarkMode ? 'Light' : 'Dark'}
              </button>
            </div>
            <div className="glass rounded-2xl p-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between card-hover">
              <div>
                <div className="text-xs uppercase tracking-[0.3em] text-slate-400">Quick Actions</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white">快速操作</div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <button
                  onClick={() => setIsAddLineModalOpen(true)}
                  className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700"
                >
                  <Plus size={14} className="inline mr-1" /> 新增线路
                </button>
                <button
                  onClick={() => setIsAddSourceModalOpen(true)}
                  className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700"
                >
                  <Database size={14} className="inline mr-1" /> 新增源站
                </button>
                <button
                  onClick={() => {
                    setActiveView('settings');
                    isEditingRef.current = true;
                  }}
                  className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700"
                >
                  <Settings size={14} className="inline mr-1" /> 系统设置
                </button>
                <button
                  onClick={() => fetchState(false)}
                  className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                >
                  <Globe size={14} className="inline mr-1" /> 刷新状态
                </button>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-6 stagger">
              <div className="glass p-6 rounded-2xl border-l-4 border-indigo-500 card-hover">
                <div className="text-4xl font-bold mb-1">{sites.length}</div>
                <div className="text-xs font-bold uppercase text-slate-500">在线服务</div>
              </div>
              <div className="glass p-6 rounded-2xl border-l-4 border-emerald-500 card-hover">
                <div className="text-4xl font-bold mb-1">{servers.filter((s) => s.status === 'online').length}</div>
                <div className="text-xs font-bold uppercase text-slate-500">线路健康</div>
              </div>
              <div className="glass p-6 rounded-2xl border-l-4 border-blue-500 card-hover">
                <div className="text-4xl font-bold mb-1">{upstreams.length}</div>
                <div className="text-xs font-bold uppercase text-slate-500">源站接入</div>
              </div>
            </div>
            <div className="glass rounded-2xl p-6 card-hover">
              <h3 className="font-bold mb-4">活跃转发规则</h3>
              {sites.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-10 text-center bg-white/70 dark:bg-slate-900/60">
                  <Globe size={28} className="mx-auto text-slate-300 mb-3" />
                  <div className="font-semibold text-slate-700 dark:text-slate-200">暂无转发规则</div>
                  <div className="text-xs text-slate-400 mt-1">先添加线路与源站，再发布服务</div>
                  <div className="mt-4 flex items-center justify-center gap-3">
                    <button
                      onClick={() => setIsAddLineModalOpen(true)}
                      className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    >
                      <Plus size={14} className="inline mr-1" /> 添加线路
                    </button>
                    <button
                      onClick={() => setIsAddSourceModalOpen(true)}
                      className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700"
                    >
                      <Database size={14} className="inline mr-1" /> 添加源站
                    </button>
                  </div>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="text-slate-500 border-b">
                    <tr>
                      <th className="py-2">域名</th>
                      <th className="py-2">目标</th>
                      <th className="py-2 text-right">状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sites.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-3 font-bold">{s.domain}</td>
                        <td className="py-3 font-mono text-xs">{s.target}</td>
                        <td className="py-3 text-right">
                          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded text-xs font-bold">Active</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {activeView === 'settings' && (
          <div className="max-w-4xl mx-auto space-y-6 fade-in-up">
            <h1 className="text-3xl font-display mb-6 dark:text-white">系统设置</h1>
            <div className="glass p-8 rounded-2xl space-y-4 card-hover">
              <h3 className="font-bold text-xl flex items-center gap-2">
                <ImageIcon size={20} /> 外观设置
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={logoInput}
                  onChange={(e) => {
                    setLogoInput(e.target.value);
                    isEditingRef.current = true;
                  }}
                  placeholder="Logo URL"
                  className="border rounded-xl px-4 py-2 w-full dark:bg-slate-900"
                />
                <input
                  value={bgInput}
                  onChange={(e) => {
                    setBgInput(e.target.value);
                    isEditingRef.current = true;
                  }}
                  placeholder="背景图片 URL"
                  className="border rounded-xl px-4 py-2 w-full dark:bg-slate-900"
                />
              </div>
            </div>
            <div className="glass p-8 rounded-2xl space-y-4 card-hover">
              <div className="flex justify-between">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <Shield size={20} /> 安全设置
                </h3>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSavingSettings}
                  className="button-glow bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm"
                >
                  保存设置
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  type={showToken ? 'text' : 'password'}
                  value={tokenInput}
                  onChange={(e) => {
                    setTokenInput(e.target.value);
                    isEditingRef.current = true;
                  }}
                  className="flex-1 border rounded-xl px-4 py-2 dark:bg-slate-900"
                />
                <button onClick={() => setShowToken(!showToken)} className="p-2">
                  <Eye size={20} />
                </button>
              </div>
            </div>
            <div className="glass p-8 rounded-2xl space-y-4 card-hover">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xl flex items-center gap-2">
                  <Globe size={20} /> Cloudflare DNS
                </h3>
                <button
                  onClick={handleCfTest}
                  disabled={isTestingCf}
                  className="button-glow bg-slate-900 text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60"
                >
                  {isTestingCf ? '测试中...' : '测试写入/删除'}
                </button>
              </div>
              <div className="text-xs text-slate-500">
                将创建并删除 TXT 记录用于验证权限，不影响你的真实解析记录。
              </div>
              <div className="grid grid-cols-2 gap-4">
                <input
                  value={cfTestDomain}
                  onChange={(e) => setCfTestDomain(e.target.value)}
                  placeholder="可选：测试域名 (默认使用 zone)"
                  className="border rounded-xl px-4 py-2 w-full dark:bg-slate-900"
                />
                <div className="text-xs text-slate-400 flex items-center">
                  例如：tqss.de 或 test.tqss.de
                </div>
              </div>
            </div>
          </div>
        )}

        {activeView === 'server_detail' && selectedServer && (
          <div className="max-w-5xl mx-auto fade-in-up">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-display dark:text-white flex items-center gap-3">
                <span className="text-4xl">{selectedServer.flag}</span> {selectedServer.name}
              </h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setManualSiteServer(selectedServer)}
                  className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl text-sm font-bold border border-indigo-100"
                >
                  手动添加反代
                </button>
                <button
                  onClick={() => handleDeleteServer(selectedServer.id)}
                  className="text-red-500 bg-red-50 px-4 py-2 rounded-xl text-sm font-bold border border-red-100"
                >
                  删除线路
                </button>
              </div>
            </div>
            <div className="glass p-8 rounded-2xl card-hover">
              <h3 className="font-bold mb-4">承载服务</h3>
              <div className="grid grid-cols-2 gap-4">
                {sites
                  .filter((s) => s.serverId === selectedServer.id)
                  .map((s) => (
                    <div key={s.id} className="border rounded-xl p-4 flex justify-between items-center gap-4">
                      <div className="min-w-0">
                        <div className="font-bold truncate">{s.domain}</div>
                        <div className="text-xs font-mono text-slate-500 truncate">{s.target}</div>
                        <div className="text-xs text-slate-400 truncate">{s.note || '无备注'}</div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSiteEditTarget(s)}
                          className="text-xs text-indigo-600 bg-indigo-50 px-2 py-1 rounded flex items-center gap-1"
                        >
                          <Pencil size={12} /> 编辑
                        </button>
                        <button
                          onClick={() => handleDeleteSite(s.id)}
                          className="text-xs text-red-500 bg-red-50 px-2 py-1 rounded"
                        >
                          下线
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {activeView === 'upstream_detail' && selectedUpstream && (
          <div className="max-w-[1600px] mx-auto fade-in-up">
            <div className="flex justify-between items-center mb-8 glass p-6 rounded-2xl card-hover">
              <div className="flex gap-4 items-center">
                <div className="bg-indigo-50 p-3 rounded-xl">
                  <Database size={24} className="text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-display">{selectedUpstream.name}</h1>
                  <p className="text-slate-500 font-mono">{selectedUpstream.ip}</p>
                  <p className="text-xs text-slate-400">
                    公网: {selectedUpstream.public_ip ? selectedUpstream.public_ip : '未检测'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDeleteUpstream(selectedUpstream.id)}
                className="text-red-500 bg-red-50 px-4 py-2 rounded-xl text-sm font-bold border border-red-100 flex gap-2"
              >
                <Trash2 size={16} /> 删除源站
              </button>
            </div>
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs text-slate-400">
                {containers.filter((c) => c.upstreamId === selectedUpstream.id && !c.hidden).length} 个正在显示
              </div>
              <button
                onClick={() => setShowHiddenContainers(!showHiddenContainers)}
                className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full"
              >
                {showHiddenContainers ? '隐藏已隐藏项' : '显示已隐藏项'}
              </button>
            </div>
            {containers.filter((c) => c.upstreamId === selectedUpstream.id && !c.hidden).length === 0 ? (
              <div className="glass rounded-2xl p-10 text-center card-hover">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-white/80 dark:bg-slate-900/80 flex items-center justify-center shadow">
                  <Database size={24} className="text-slate-400" />
                </div>
                <div className="mt-4 font-semibold text-slate-700 dark:text-slate-200">暂无容器</div>
                <div className="text-xs text-slate-400 mt-1">Agent 未连接或当前源站没有运行中的服务</div>
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() => setShowHiddenContainers(true)}
                    className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700"
                  >
                    显示已隐藏项
                  </button>
                  <button
                    onClick={() => setActiveView('dashboard')}
                    className="button-glow px-4 py-2 rounded-xl text-sm font-semibold bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  >
                    返回仪表盘
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-6 stagger">
                {containers
                  .filter((c) => c.upstreamId === selectedUpstream.id && !c.hidden)
                  .map((c) => {
                    const site = getSiteForContainer(c.id);
                    const address = getPublicAddress(selectedUpstream, c.port);
                    const siteUrl = site ? `${site.https ? 'https' : 'http'}://${site.domain}` : '';
                    return (
                      <div
                        key={c.id}
                        className="group relative bg-white dark:bg-slate-900 rounded-2xl border p-6 card-hover flex flex-col justify-between shadow-sm"
                      >
                        <div>
                          <div className="flex gap-4 mb-4 relative">
                            <div className="w-14 h-14 bg-white rounded-xl shadow p-2 relative group/icon">
                              <SmartIcon container={c} className="w-full h-full" />
                              <FallbackIcon className="w-full h-full" />
                              <button
                                onClick={() => setIconEditTarget(c)}
                                className="absolute -top-2 -right-2 bg-slate-800 text-white p-1 rounded-full opacity-0 group-hover/icon:opacity-100 transition-opacity"
                              >
                                <Pencil size={10} />
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-bold truncate" title={c.displayName || c.name}>
                                {c.displayName || c.name}
                              </h3>
                              <div className="text-xs text-slate-400 truncate">{c.image}</div>
                              {c.note ? <div className="text-xs text-slate-500 truncate">{c.note}</div> : null}
                            </div>
                            <button
                              onClick={() => setContainerEditTarget(c)}
                              className="absolute top-0 right-0 text-slate-400 hover:text-indigo-500"
                            >
                              <Pencil size={14} />
                            </button>
                          </div>
                          <div className="flex justify-between text-xs mb-3">
                            <span className="font-bold text-slate-400">PORT</span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded font-mono">{c.port}</span>
                          </div>
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">公网访问</span>
                              {address ? (
                                <a
                                  href={`http://${address}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-indigo-600 hover:text-indigo-500"
                                >
                                  {address} <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span className="text-slate-300">未检测</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 font-semibold">域名访问</span>
                              {siteUrl ? (
                                <a
                                  href={siteUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-1 text-emerald-600 hover:text-emerald-500"
                                >
                                  {site.domain} <ExternalLink size={12} />
                                </a>
                              ) : (
                                <span className="text-slate-300">未发布</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <button
                            onClick={() => setDeployTarget({ container: c, upstream: selectedUpstream })}
                            className="button-glow w-full bg-slate-900 text-white py-2 rounded-xl font-bold text-sm hover:bg-indigo-600 transition-colors flex justify-center gap-2"
                          >
                            <Globe size={14} /> 发布
                          </button>
                          <button
                            onClick={() => handleUpdateContainerMeta({ containerName: c.name, hidden: true })}
                            className="w-full text-xs text-slate-500 bg-slate-100 py-2 rounded-xl"
                          >
                            从面板隐藏
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            {showHiddenContainers && (
              <div className="mt-8 glass p-6 rounded-2xl card-hover">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">已隐藏的容器</h3>
                  <span className="text-xs text-slate-400">
                    {containers.filter((c) => c.upstreamId === selectedUpstream.id && c.hidden).length} 个
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {containers
                    .filter((c) => c.upstreamId === selectedUpstream.id && c.hidden)
                    .map((c) => (
                      <div key={c.id} className="border rounded-xl p-4 flex justify-between items-center">
                        <div className="min-w-0">
                          <div className="font-bold truncate">{c.displayName || c.name}</div>
                          <div className="text-xs text-slate-400 truncate">{c.image}</div>
                        </div>
                        <button
                          onClick={() => handleUpdateContainerMeta({ containerName: c.name, hidden: false })}
                          className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded"
                        >
                          恢复显示
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {deployTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-[600px] fade-in-up">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">发布服务</h2>
              <button onClick={() => setDeployTarget(null)}>
                <X />
              </button>
            </div>
            <form onSubmit={handleDeploy} className="space-y-6">
              <div>
                <label className="block font-bold mb-2">选择线路</label>
                <div className="grid grid-cols-2 gap-4">
                  {servers.map((s) => (
                    <label
                      key={s.id}
                      className="border p-4 rounded-xl cursor-pointer hover:border-indigo-500 peer-checked:bg-indigo-50"
                    >
                      <input type="radio" name="serverId" value={s.id} required className="mr-2" />
                      {s.flag} {s.name}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block font-bold mb-2">域名</label>
                <input
                  name="domain"
                  className="w-full border p-3 rounded-xl font-mono"
                  defaultValue={`${deployTarget.container.name}.com`}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setDeployTarget(null)} className="px-4 py-2 rounded-xl hover:bg-slate-100">
                  取消
                </button>
                <button className="button-glow bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">确认</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {siteEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-[520px] fade-in-up">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">编辑反代规则</h2>
              <button onClick={() => setSiteEditTarget(null)}>
                <X />
              </button>
            </div>
            <form onSubmit={handleUpdateSite} className="space-y-4">
              <div>
                <label className="block font-bold mb-2">域名</label>
                <input
                  name="domain"
                  className="w-full border p-3 rounded-xl font-mono"
                  defaultValue={siteEditTarget.domain}
                  required
                />
              </div>
              <div>
                <label className="block font-bold mb-2">目标 (IP:端口)</label>
                <input
                  name="target"
                  className="w-full border p-3 rounded-xl font-mono"
                  defaultValue={siteEditTarget.target}
                  required
                />
              </div>
              <div>
                <label className="block font-bold mb-2">备注</label>
                <input
                  name="note"
                  className="w-full border p-3 rounded-xl"
                  defaultValue={siteEditTarget.note || ''}
                  placeholder="例如：SunPanel 主站"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <input name="https" type="checkbox" defaultChecked={!!siteEditTarget.https} />
                强制使用 HTTPS
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setSiteEditTarget(null)} className="px-4 py-2 rounded-xl hover:bg-slate-100">
                  取消
                </button>
                <button className="button-glow bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {containerEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-[520px] fade-in-up">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">编辑容器显示</h2>
              <button onClick={() => setContainerEditTarget(null)}>
                <X />
              </button>
            </div>
            <form onSubmit={handleEditContainer} className="space-y-4">
              <div>
                <label className="block font-bold mb-2">显示名称</label>
                <input
                  name="alias"
                  className="w-full border p-3 rounded-xl"
                  defaultValue={containerEditTarget.displayName !== containerEditTarget.name ? containerEditTarget.displayName : ''}
                  placeholder={containerEditTarget.name}
                />
              </div>
              <div>
                <label className="block font-bold mb-2">备注</label>
                <input
                  name="note"
                  className="w-full border p-3 rounded-xl"
                  defaultValue={containerEditTarget.note || ''}
                  placeholder="例如：内部数据库"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <input name="hidden" type="checkbox" defaultChecked={!!containerEditTarget.hidden} />
                在面板中隐藏
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setContainerEditTarget(null)} className="px-4 py-2 rounded-xl hover:bg-slate-100">
                  取消
                </button>
                <button className="button-glow bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {manualSiteServer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-[520px] fade-in-up">
            <div className="flex justify-between mb-6">
              <h2 className="text-xl font-bold">手动添加反代</h2>
              <button onClick={() => setManualSiteServer(null)}>
                <X />
              </button>
            </div>
            <form onSubmit={handleCreateManualSite} className="space-y-4">
              <div>
                <label className="block font-bold mb-2">域名</label>
                <input name="domain" className="w-full border p-3 rounded-xl font-mono" required />
              </div>
              <div>
                <label className="block font-bold mb-2">目标 (IP:端口)</label>
                <input name="target" className="w-full border p-3 rounded-xl font-mono" required />
              </div>
              <div>
                <label className="block font-bold mb-2">备注</label>
                <input name="note" className="w-full border p-3 rounded-xl" placeholder="例如：JD 服务" />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-500">
                <input name="https" type="checkbox" defaultChecked />
                强制使用 HTTPS
              </label>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setManualSiteServer(null)} className="px-4 py-2 rounded-xl hover:bg-slate-100">
                  取消
                </button>
                <button className="button-glow bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">添加</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {iconEditTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-[400px] fade-in-up">
            <h2 className="text-xl font-bold mb-4">修改图标</h2>
            <form onSubmit={handleUpdateIcon} className="space-y-4">
              <input
                name="iconUrl"
                className="w-full border p-3 rounded-xl"
                placeholder="输入图片 URL"
                autoFocus
                defaultValue={iconEditTarget.customIcon}
              />
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setIconEditTarget(null)} className="px-4 py-2 rounded-xl hover:bg-slate-100">
                  取消
                </button>
                <button className="button-glow bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold">保存</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAddLineModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setIsAddLineModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-[620px] fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">添加公网线路 (Caddy)</h2>
              <button onClick={() => setIsAddLineModalOpen(false)}>
                <X />
              </button>
            </div>
            <div className="space-y-4">
              <div className="text-sm">
                <label className="block text-slate-500 font-semibold mb-1">自定义名称</label>
                <input
                  value={caddyNameInput}
                  onChange={(e) => setCaddyNameInput(e.target.value)}
                  placeholder="例如：巴黎节点-1"
                  className="w-full border rounded-xl px-3 py-2 dark:bg-slate-900"
                />
              </div>
              <div className="text-sm text-slate-500">
                在公网 VPS 上执行以下命令，安装 Caddy 并自动注册线路。
              </div>
              <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono flex items-start justify-between gap-4">
                <div className="whitespace-pre-wrap break-all flex-1">{getCmd('caddy')}</div>
                <button
                  onClick={() => copyCmd(getCmd('caddy'))}
                  className="button-glow bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 flex items-center gap-2"
                >
                  <Copy size={14} /> 复制
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Terminal size={14} /> Caddy 启动后会自动调用面板注册。
              </div>
            </div>
          </div>
        </div>
      )}

      {isAddSourceModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => setIsAddSourceModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 p-8 rounded-2xl w-[620px] fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between mb-4">
              <h2 className="text-xl font-bold">添加内网源站 (Agent)</h2>
              <button onClick={() => setIsAddSourceModalOpen(false)}>
                <X />
              </button>
            </div>
            <div className="space-y-4">
              <div className="text-sm">
                <label className="block text-slate-500 font-semibold mb-1">自定义名称</label>
                <input
                  value={agentNameInput}
                  onChange={(e) => setAgentNameInput(e.target.value)}
                  placeholder="例如：NAS-客厅"
                  className="w-full border rounded-xl px-3 py-2 dark:bg-slate-900"
                />
              </div>
              <div className="text-sm text-slate-500">
                在需要被管理的机器上执行以下命令，安装 Agent 并开始上报状态。
              </div>
              <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono flex items-start justify-between gap-4">
                <div className="whitespace-pre-wrap break-all flex-1">{getCmd('agent')}</div>
                <button
                  onClick={() => copyCmd(getCmd('agent'))}
                  className="button-glow bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 flex items-center gap-2"
                >
                  <Copy size={14} /> 复制
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Terminal size={14} /> Token 可在系统设置中自定义。
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
