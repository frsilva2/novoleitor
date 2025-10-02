// js/scanner.js - Módulo do Scanner Real (corrigido)
class ScannerReal {
    constructor() {
        this.html5QrCode = null;
        this.isScanning = false;
        this.currentStream = null;
        this.lastScanTime = 0;
        this.bibliotecaDePara = {};
        this.mapeamentoCores = {};
    }

    // Inicializar scanner
    async init() {
        try {
            await this.carregarBiblioteca();
            this.setupEventListeners();
            console.log('Scanner inicializado com sucesso');
        } catch (error) {
            console.error('Erro ao inicializar scanner:', error);
            throw error;
        }
    }

    // Carregar biblioteca DE→PARA do arquivo JSON
    async carregarBiblioteca() {
        try {
            const response = await fetch('./data/depara.json');
            const data = await response.json();

            // Aceita tanto formato de objeto quanto array
            if (Array.isArray(data)) {
                const mapa = {};
                for (const row of data) {
                    const fornecedor = String(row.fornecedor_grupo || '').trim().toUpperCase();
                    let codForn = String(row.codigoprodutofornecedor ?? '')
                        .replace(/\D+/g, '')
                        .replace(/^0+/, '') || '0';
                    if (!codForn) continue;
                    mapa[codForn] = {
                        codigoERP: row.codigoerp != null ? String(row.codigoerp).split('.')[0] : null,
                        nomeERP: row.nomeerp || null,
                        fornecedor: fornecedor || null
                    };
                }
                this.bibliotecaDePara = mapa;
                this.mapeamentoCores = {};
            } else {
                this.bibliotecaDePara = data.produtos || {};
                this.mapeamentoCores = data.mapeamentoCores || {};
            }

            const totalProdutos = Object.keys(this.bibliotecaDePara).length;
            document.getElementById('totalMappings').textContent = totalProdutos;
            console.log(`Biblioteca carregada: ${totalProdutos} produtos`);
            return data;
        } catch (error) {
            console.error('Erro ao carregar biblioteca:', error);
            this.carregarBibliotecaFallback();
        }
    }

    // Biblioteca fallback (caso o JSON não carregue)
    carregarBibliotecaFallback() {
        this.bibliotecaDePara = {
            "5038103": { codigoERP: "14527", nomeERP: "ALFAIATARIA NEW LOOK - LISO", fornecedor: "EURO" },
            "4700103": { codigoERP: "9109", nomeERP: "OXFORDINE", fornecedor: "EURO" },
            "20030005": { codigoERP: "14527", nomeERP: "ALFAIATARIA NEW LOOK - LISO", fornecedor: "LITORAL" }
        };
        this.mapeamentoCores = { '100': 'branco', '103': 'tinto', '999': 'preto', '408': 'azul', '500': 'cinza' };
        console.log('Biblioteca fallback carregada');
    }

    setupEventListeners() {
        document.getElementById('startBtn')?.addEventListener('click', () => this.iniciarScanner());
        document.getElementById('stopBtn')?.addEventListener('click', () => this.pararScanner());
        document.getElementById('flashBtn')?.addEventListener('click', () => this.toggleFlash());
    }

    async iniciarScanner() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const status = document.getElementById('scannerStatus');

        try {
            startBtn.disabled = true;
            status.textContent = 'Iniciando scanner...';

            this.html5QrCode = new Html5Qrcode("scanner-container");
            const config = { fps: 10, qrbox: { width: 300, height: 120 }, aspectRatio: 1.0,
                supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA] };

            await this.html5QrCode.start(
                { facingMode: "environment" },
                config,
                (decodedText) => this.onScanSuccess(decodedText),
                (error) => this.onScanError(error)
            );

            this.isScanning = true;
            stopBtn.disabled = false;
            status.textContent = 'Scanner ativo - Posicione o código na área destacada';
            this.showNotification('Scanner iniciado com sucesso!', 'success');
        } catch (err) {
            console.error('Erro HTML5QRCode:', err);
            try {
                await this.iniciarQuaggaScanner();
            } catch (quaggaErr) {
                console.error('Erro QuaggaJS:', quaggaErr);
                status.textContent = 'Erro ao iniciar scanner';
                startBtn.disabled = false;
                this.showNotification('Erro ao acessar câmera: ' + err.message, 'error');
            }
        }
    }

    async iniciarQuaggaScanner() {
        return new Promise((resolve, reject) => {
            Quagga.init({
                inputStream: { name: "Live", type: "LiveStream", target: document.querySelector('#scanner-container'),
                    constraints: { width: 400, height: 300, facingMode: "environment" } },
                decoder: { readers: ["code_128_reader","ean_reader","ean_8_reader","code_39_reader","i2of5_reader"] }
            }, (err) => {
                if (err) { reject(err); return; }
                Quagga.start();
                this.isScanning = true;
                document.getElementById('stopBtn').disabled = false;
                document.getElementById('scannerStatus').textContent = 'Scanner QuaggaJS ativo';
                this.showNotification('Scanner QuaggaJS iniciado!', 'success');
                resolve();
            });
            Quagga.onDetected((data) => this.onScanSuccess(data.codeResult.code));
        });
    }

    onScanSuccess(decodedText) {
        const now = Date.now();
        if (now - this.lastScanTime < 2000) return;
        this.lastScanTime = now;
        console.log('Código lido:', decodedText);
        this.processarCodigo(decodedText);
        this.playBeep();
        this.showNotification(`Código lido: ${decodedText}`, 'success');
    }

    onScanError(error) { /* silencioso */ }

    processarCodigo(codigo) {
        const resultado = window.CodigoDecoder.decodificar(codigo, this.bibliotecaDePara, this.mapeamentoCores);
        if (resultado) {
            this.preencherCampos(resultado);
            this.showNotification(`Produto: ${resultado.nomeERP}`, 'success');
        } else {
            this.preencherCamposDesconhecido(codigo);
            this.showNotification('Código não reconhecido', 'warning');
        }
    }

    preencherCampos(resultado) {
        document.getElementById('barcode').value = resultado.codigoFornecedor || '';
        document.getElementById('productName').value = resultado.nomeERP || '';
        document.getElementById('erpCodeDisplay').value = resultado.codigoERP || '';
        if (resultado.quantidade > 0) document.getElementById('quantity').value = resultado.quantidade;
        if (resultado.cor) document.getElementById('color').value = resultado.cor;
        if (resultado.observacoes) document.getElementById('observations').value = resultado.observacoes;
    }

    preencherCamposDesconhecido(codigo) {
        document.getElementById('barcode').value = codigo;
        document.getElementById('productName').value = 'PRODUTO NÃO MAPEADO';
        document.getElementById('erpCodeDisplay').value = codigo;
        document.getElementById('quantity').value = '';
        document.getElementById('color').value = '';
        document.getElementById('observations').value = 'Código não encontrado na biblioteca';
    }

    async pararScanner() {
        const startBtn = document.getElementById('startBtn');
        const stopBtn = document.getElementById('stopBtn');
        const status = document.getElementById('scannerStatus');
        try {
            if (this.html5QrCode && this.isScanning) await this.html5QrCode.stop();
            if (typeof Quagga !== 'undefined') Quagga.stop();
            this.isScanning = false;
            startBtn.disabled = false; stopBtn.disabled = true;
            status.textContent = 'Scanner parado';
            this.showNotification('Scanner parado', 'success');
        } catch (err) {
            console.error('Erro ao parar scanner:', err);
        }
    }

    async toggleFlash() {
        this.showNotification('Flash não implementado nesta versão', 'warning');
    }

    playBeep() {
        if ('AudioContext' in window) {
            const audioContext = new AudioContext();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = 800;
            oscillator.type = 'square';
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        }
    }

    showNotification(message, type = 'success') {
        const notification = document.getElementById('notification');
        if (notification) {
            notification.textContent = message;
            notification.className = `notification ${type} show`;
            setTimeout(() => { notification.classList.remove('show'); }, 3000);
        }
    }
}

// Instanciar scanner global
window.ScannerReal = new ScannerReal();
