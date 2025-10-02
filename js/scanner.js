// js/scanner.js — Scanner Real (versão final, DEPARA = objeto)
class ScannerReal {
  constructor() {
    this.html5QrCode = null;
    this.isScanning = false;
    this.lastScanTime = 0;

    this.bibliotecaDePara = {};
    this.mapeamentoCores = {};
  }

  async init() {
    try {
      await this.carregarBiblioteca();
      this.setupEventListeners();
      console.log('✅ Scanner inicializado');
    } catch (err) {
      console.error('❌ Erro ao iniciar scanner:', err);
      this.showNotification('Erro ao iniciar scanner', 'error');
    }
  }

  async carregarBiblioteca() {
    const setTotal = (n) => {
      const el = document.getElementById('totalMappings');
      if (el) el.textContent = n;
    };

    const url = `./data/depara.json?v=${Date.now()}`;
    let data = null;

    try {
      const resp = await fetch(url, { cache: 'no-store' });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      data = await resp.json();
      console.log('📥 Carregado:', url);
    } catch (e) {
      console.error('Erro ao carregar DEPARA:', e);
      this.bibliotecaDePara = {};
      this.mapeamentoCores = {};
      setTotal(0);
      return;
    }

    if (data && typeof data === 'object' && data.produtos) {
      this.bibliotecaDePara = data.produtos;
      this.mapeamentoCores = data.mapeamentoCores || {};
      const n = Object.keys(this.bibliotecaDePara).length;
      console.log(`📚 Itens (mapa): ${n}`);
      setTotal(n);
    } else {
      console.warn('Formato inesperado de DEPARA');
      this.bibliotecaDePara = {};
      this.mapeamentoCores = {};
      setTotal(0);
    }
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

      this.isScanning = true;
      if (stopBtn) stopBtn.disabled = false;
      if (status) status.textContent = 'Scanner ativo - Posicione o código';
      this.showNotification('Scanner iniciado', 'success');

    } catch (err) {
      console.error('⚠️ HTML5QrCode falhou:', err);
      this.showNotification('Erro ao acessar câmera', 'error');
    }
  }

  onScanSuccess(decodedText) {
    const now = Date.now();
    if (now - this.lastScanTime < 1200) return;
    this.lastScanTime = now;

    console.log('🔎 Código lido:', decodedText);
    this.processarCodigo(decodedText);
    this.playBeep();
    this.showNotification(`Código: ${decodedText}`, 'success');
  }

  processarCodigo(codigo) {
    const resultado = window.CodigoDecoder.decodificar(
      codigo, this.bibliotecaDePara, this.mapeamentoCores
    );
    if (resultado && resultado.nomeERP && resultado.codigoERP) {
      this.preencherCampos(resultado);
    } else {
      this.preencherCamposDesconhecido(codigo);
    }
  }

  preencherCampos(res) {
    const $ = (id) => document.getElementById(id);
    $('#barcode').value        = res.codigoFornecedor || '';
    $('#productName').value    = res.nomeERP || '';
    $('#erpCodeDisplay').value = res.codigoERP || '';
    if (res.quantidade > 0) $('#quantity').value = res.quantidade;
    if (res.cor) $('#color').value = res.cor;
    if (res.observacoes) $('#observations').value = res.observacoes;
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

  async pararScanner() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn  = document.getElementById('stopBtn');
    const status   = document.getElementById('scannerStatus');

    try {
      if (this.html5QrCode && this.isScanning) await this.html5QrCode.stop();
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
    setTimeout(() => el.classList.remove('show'), 2500);
  }
}

window.ScannerReal = new ScannerReal();
