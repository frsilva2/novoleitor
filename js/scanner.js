// js/scanner.js — Scanner Real (versão robusta/final)
class ScannerReal {
  constructor() {
    this.html5QrCode = null;
    this.isScanning = false;
    this.lastScanTime = 0;

    // Biblioteca DE→PARA (mapa: codFornecedor -> {codigoERP, nomeERP, fornecedor})
    this.bibliotecaDePara = {};
    this.mapeamentoCores = {};
  }

  // ===== Boot =====
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

  // ===== Carregar DE→PARA (robusto) =====
  async carregarBiblioteca() {
    const setTotal = (n) => {
      const el = document.getElementById('totalMappings');
      if (el) el.textContent = n;
    };
    const note = (msg, type='error') => {
      console[(type==='error'?'error':'log')]('[DEPARA]', msg);
      const el = document.getElementById('notification');
      if (el) {
        el.textContent = msg;
        el.className = `notification ${type} show`;
        setTimeout(()=>el.classList.remove('show'), 3500);
      }
    };

    // Tenta múltiplos caminhos/caixas e com cache-bust
    const now = Date.now();
    const candidates = [
      `./data/depara.json?v=${now}`,
      `./data/DEPARA.json?v=${now}`,
      `./data/depara_mapa.json?v=${now}`
    ];

    let data = null;
    let lastErr = null;
    for (const url of candidates) {
      try {
        const resp = await fetch(url, { cache: 'no-store' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        data = await resp.json();
        console.log('📥 Carregado:', url);
        break;
      } catch (e) {
        lastErr = e;
        console.warn('⚠️ Falhou:', url, '-', e.message);
      }
    }
    if (!data) {
      note(`Falha ao carregar DEPARA (verifique /data/depara.json). Último erro: ${lastErr?.message||''}`);
      this.bibliotecaDePara = {};
      this.mapeamentoCores = {};
      setTotal(0);
      return;
    }

    // Aceita OBJETO (mapa) ou ARRAY
    if (Array.isArray(data)) {
      const mapa = {};
      let ignorados = 0;

      for (const row of data) {
        const fornecedor = String(row.fornecedor_grupo || '').trim().toUpperCase();
        // só dígitos + remove zeros à esquerda
        let codForn = String(row.codigoprodutofornecedor ?? '').replace(/\D+/g, '').replace(/^0+/, '');
        if (!codForn) { ignorados++; continue; }

        const codigoERP = row.codigoerp != null ? String(row.codigoerp).split('.')[0] : null;
        mapa[codForn] = { codigoERP, nomeERP: row.nomeerp || null, fornecedor: fornecedor || null };
      }

      this.bibliotecaDePara = mapa;
      this.mapeamentoCores = {};
      const n = Object.keys(mapa).length;
      console.log(`📚 Itens (array): ${n} | ignorados: ${ignorados}`);
      setTotal(n);
      return;
    }

    if (data && typeof data === 'object') {
      if (!data.produtos || typeof data.produtos !== 'object') {
        note('JSON objeto sem chave "produtos".', 'error');
        this.bibliotecaDePara = {};
        this.mapeamentoCores = {};
        setTotal(0);
        return;
      }
      this.bibliotecaDePara = data.produtos || {};
      this.mapeamentoCores = (data.mapeamentoCores && typeof data.mapeamentoCores === 'object') ? data.mapeamentoCores : {};
      const n = Object.keys(this.bibliotecaDePara).length;
      console.log(`📚 Itens (mapa): ${n}`);
      setTotal(n);
      return;
    }

    note('Formato de JSON desconhecido.', 'error');
    this.bibliotecaDePara = {};
    this.mapeamentoCores = {};
    setTotal(0);
  }

  // ===== Fallback mínimo (se JSON não carregar) =====
  carregarBibliotecaFallback() {
    this.bibliotecaDePara = {
      "5038103": { codigoERP: "14527", nomeERP: "ALFAIATARIA NEW LOOK - LISO", fornecedor: "EURO" },
      "4700103": { codigoERP: "9109",  nomeERP: "OXFORDINE", fornecedor: "EURO"  },
      "20030005":{ codigoERP: "14527", nomeERP: "ALFAIATARIA NEW LOOK - LISO", fornecedor: "LITORAL" }
    };
    this.mapeamentoCores = { '100':'branco','103':'tinto','999':'preto','408':'azul','500':'cinza' };
    const n = Object.keys(this.bibliotecaDePara).length;
    const el = document.getElementById('totalMappings');
    if (el) el.textContent = n;
    console.log('📦 Biblioteca fallback carregada');
  }

  // ===== UI / Eventos =====
  setupEventListeners() {
    document.getElementById('startBtn')?.addEventListener('click', () => this.iniciarScanner());
    document.getElementById('stopBtn')?.addEventListener('click',  () => this.pararScanner());
    document.getElementById('flashBtn')?.addEventListener('click', () => this.toggleFlash());
  }

  // ===== Scanner =====
  async iniciarScanner() {
    const startBtn = document.getElementById('startBtn');
    const stopBtn  = document.getElementById('stopBtn');
    const status   = document.getElementById('scannerStatus');

    try {
      if (startBtn) startBtn.disabled = true;
      if (status) status.textContent = 'Iniciando scanner...';

      // HTML5-QRCode
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
        () => {} // erros de leitura são normais
      );

      this.isScanning = true;
      if (stopBtn) stopBtn.disabled = false;
      if (status) status.textContent = 'Scanner ativo - Posicione o código';
      this.showNotification('Scanner iniciado', 'success');

    } catch (err) {
      console.error('⚠️ HTML5QrCode falhou, tentando Quagga:', err);
      // Fallback Quagga
      try {
        await this.iniciarQuaggaScanner();
      } catch (qErr) {
        console.error('❌ Quagga falhou:', qErr);
        if (status) status.textContent = 'Erro ao iniciar scanner';
        if (startBtn) startBtn.disabled = false;
        this.showNotification('Erro ao acessar câmera', 'error');
      }
    }
  }

  async iniciarQuaggaScanner() {
    return new Promise((resolve, reject) => {
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: document.querySelector('#scanner-container'),
          constraints: { width: 400, height: 300, facingMode: "environment" }
        },
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "code_39_reader",
            "i2of5_reader"
          ]
        }
      }, (err) => {
        if (err) { reject(err); return; }
        Quagga.start();
        this.isScanning = true;
        const stopBtn = document.getElementById('stopBtn');
        const status  = document.getElementById('scannerStatus');
        if (stopBtn) stopBtn.disabled = false;
        if (status) status.textContent = 'Scanner QuaggaJS ativo';
        this.showNotification('Scanner QuaggaJS iniciado', 'success');
        resolve();
      });

      Quagga.onDetected((data) => {
        const code = data?.codeResult?.code;
        if (code) this.onScanSuccess(code);
      });
    });
  }

  onScanSuccess(decodedText) {
    // de-bounce
    const now = Date.now();
    if (now - this.lastScanTime < 1200) return;
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

  // ===== Processamento =====
  processarCodigo(codigo) {
    // Usa o decoder já corrigido (EURO + LITORAL)
    const resultado = window.CodigoDecoder.decodificar(
      codigo,
      this.bibliotecaDePara,
      this.mapeamentoCores
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

  // ===== UX =====
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

// Expor globalmente
window.ScannerReal = new ScannerReal();
// Inicie no index com: window.ScannerReal.init();
