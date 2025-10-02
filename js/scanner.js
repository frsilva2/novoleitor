// js/scanner.js — versão robusta c/ espera de libs e DEPARA fixo (mapa)
class ScannerReal {
  constructor() {
    this.html5QrCode = null;
    this.isScanning = false;
    this.lastScanTime = 0;
    this.bibliotecaDePara = {};
    this.mapeamentoCores = {};
  }

  async waitForGlobals(timeoutMs = 6000) {
    const need = () =>
      typeof window.CodigoDecoder !== 'undefined' &&
      (typeof window.Html5Qrcode !== 'undefined' || typeof window.Quagga !== 'undefined');

    const t0 = Date.now();
    while (!need()) {
      await new Promise(r => setTimeout(r, 100));
      if (Date.now() - t0 > timeoutMs) {
        throw new Error('Dependências não disponíveis (Html5Qrcode/CodigoDecoder)');
      }
    }
  }

  async init() {
    try {
      await this.waitForGlobals();                      // ← garante libs carregadas
      await this.carregarBiblioteca();                  // ← carrega DEPARA
      this.setupEventListeners();
      this.showNotification(`DEPARA OK • ${Object.keys(this.bibliotecaDePara).length} itens`, 'success');
      console.log('✅ Scanner inicializado');
    } catch (err) {
      console.error('❌ Erro ao iniciar scanner:', err);
      this.showNotification(err.message || 'Erro ao iniciar', 'error');
    }
  }

  async carregarBiblioteca() {
    const setTotal = (n) => {
      const el = document.getElementById('totalMappings');
      if (el) el.textContent = n;
    };

    const url = `./data/depara.json?v=${Date.now()}`;  // ← seu arquivo comprovado
    let data = null;

    const resp = await fetch(url, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`Falha ao carregar DEPARA (HTTP ${resp.status})`);
    try {
      data = await resp.json();
    } catch (e) {
      throw new Error('JSON inválido em /data/depara.json');
    }

    if (!data || typeof data !== 'object' || typeof data.produtos !== 'object') {
      throw new Error('Formato do DEPARA inesperado (esperado {"produtos":{...}})');
    }

    this.bibliotecaDePara = data.produtos;
    this.mapeamentoCores = data.mapeamentoCores || {};
    setTotal(Object.keys(this.bibliotecaDePara).length);
    console.log('📚 Itens (mapa):', Object.keys(this.bibliotecaDePara).length);
  }

  setupEventListeners() {
    document.getElementById('startBtn')?.addEventListener('click', () => this.iniciarScanner());
    document.getElementById('stopBtn')?.addEventListener('click',  () => this.pararScanner());
    document.getElementById('flashBtn')?.addEventListener('click', () => this.toggleFlash());
  }

  async iniciarScanner() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn  = document.getElementById('stopBtn');
    const status   = document.getElementById('scannerStatus');

    try {
      if (startBtn) startBtn.disabled = true;
      if (status) status.textContent = 'Iniciando scanner...';

      if (typeof Html5Qrcode !== 'undefined') {
        this.html5QrCode = new Html5Qrcode("scanner-container");
        const config = {
          fps: 10,
          qrbox: { width: 300, height: 120 },
          aspectRatio: 1.0,
          supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        };
        await this.html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => this.onScanSuccess(decodedText),
          () => {}
        );
      } else if (typeof Quagga !== 'undefined') {
        await this.iniciarQuaggaScanner();
      } else {
        throw new Error('Nenhuma lib de câmera disponível');
      }

      this.isScanning = true;
      if (stopBtn) stopBtn.disabled = false;
      if (status) status.textContent = 'Scanner ativo - Posicione o código';
      this.showNotification('Scanner iniciado', 'success');

    } catch (err) {
      console.error('⚠️ Erro ao iniciar scanner:', err);
      if (status) status.textContent = 'Erro ao iniciar scanner';
      if (startBtn) startBtn.disabled = false;
      this.showNotification(err.message || 'Erro ao acessar câmera', 'error');
    }
  }

  async iniciarQuaggaScanner() {
    return new Promise((resolve, reject) => {
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.querySelector('#scanner-container'),
        },
        decoder: { readers: ["code_128_reader","ean_reader","ean_8_reader","code_39_reader","i2of5_reader"] }
      }, (err) => {
        if (err) return reject(err);
        Quagga.start();
        const stopBtn = document.getElementById('stopBtn');
        const status  = document.getElementById('scannerStatus');
        if (stopBtn) stopBtn.disabled = false;
        if (status) status.textContent = 'Scanner QuaggaJS ativo';
        resolve();
      });
      Quagga.onDetected((data) => {
        const code = data?.codeResult?.code;
        if (code) this.onScanSuccess(code);
      });
    });
  }

  onScanSuccess(decodedText) {
    const now = Date.now();
    if (now - this.lastScanTime < 1200) return; // de-bounce
    this.lastScanTime = now;

    console.log('🔎 Código lido:', decodedText);
    this.processarCodigo(decodedText);
    this.playBeep();
    this.showNotification(`Código: ${decodedText}`, 'success');
  }

  async pararScanner() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn  = document.getElementById('stopBtn');
    const status   = document.getElementById('scannerStatus');

    try {
      if (this.html5QrCode && this.isScanning) await this.html5QrCode.stop();
      if (typeof Quagga !== 'undefined') Quagga.stop();
      this.isScanning = false;
      if (startBtn) startBtn.disabled = false;
      if (stopBtn)  stopBtn.disabled = true;
      if (status)   status.textContent = 'Scanner parado';
      this.showNotification('Scanner parado', 'success');
    } catch (err) {
      console.error('Erro ao parar scanner:', err);
    }
  }

  async toggleFlash() {
    this.showNotification('Flash não implementado', 'warning');
  }

  processarCodigo(codigo) {
    const r = window.CodigoDecoder.decodificar(
      codigo, this.bibliotecaDePara, this.mapeamentoCores
    );
    if (r && r.nomeERP && r.codigoERP) this.preencherCampos(r);
    else this.preencherCamposDesconhecido(codigo);
  }

  preencherCampos(res) {
    const $ = (id) => document.getElementById(id);
    $('#barcode').value        = res.codigoFornecedor || '';
    $('#productName').value    = res.nomeERP || '';
    $('#erpCodeDisplay').value = res.codigoERP || '';
    if (res.quantidade > 0) $('#quantity').value = res.quantidade;
    if (res.cor)             $('#color').value    = res.cor;
    if (res.observacoes)     $('#observations').value = res.observacoes;
  }

  preencherCamposDesconhecido(codigo) {
    const $ = (id) => document.getElementById(id);
    $('#barcode').value        = codigo;
    $('#productName').value    = 'PRODUTO NÃO MAPEADO';
    $('#erpCodeDisplay').value = '';
    $('#quantity').value       = '';
    $('#color').value          = '';
    $('#observations').value   = 'Código não encontrado na biblioteca';
  }

  playBeep() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 820; osc.type = 'square';
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
      osc.start(); osc.stop(ctx.currentTime + 0.1);
    } catch {}
  }

  showNotification(message, type = 'success') {
    const el = document.getElementById('notification');
    if (!el) return;
    el.textContent = message;
    el.className = `notification ${type} show`;
    setTimeout(() => el.classList.remove('show'), 3000);
  }
}

window.ScannerReal = new ScannerReal();
