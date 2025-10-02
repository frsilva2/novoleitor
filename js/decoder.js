// js/decoder.js - Módulo de Decodificação de Códigos (ajustado)
class CodigoDecoder {
  static decodificar(codigoCompleto, bibliotecaDePara, mapeamentoCores = {}) {
    // fornecedor por padrão do código
    const fornecedor = this.identificarFornecedorPorPadrao(codigoCompleto);

    let resultado = null;

    // Caso 1: LITORAL contínuo (string só de dígitos longa, sem pontos)
    if (fornecedor === 'LITORAL' && !codigoCompleto.includes('.')) {
      resultado = this.decodificarLitoralContinuo(codigoCompleto, bibliotecaDePara);
    }
    // Caso 2: Formatos com pontos (EURO e alguns LITORAL)
    else if (codigoCompleto.includes('.')) {
      resultado = this.decodificarComPontos(codigoCompleto, bibliotecaDePara, mapeamentoCores);
    }
    // Caso 3: Código simples (somente dígitos, 5-8 ou 7 dígitos)
    else {
      resultado = this.decodificarCodigoSimples(codigoCompleto, bibliotecaDePara);
    }

    if (resultado) return resultado;

    // Fallback
    return {
      codigoFornecedor: codigoCompleto,
      quantidade: 0,
      cor: '',
      codigoERP: codigoCompleto,
      nomeERP: 'PRODUTO NÃO MAPEADO',
      fornecedor: 'DESCONHECIDO',
      padraoEncontrado: 'nenhum'
    };
  }

  static identificarFornecedorPorPadrao(codigo) {
    const clean = codigo.trim();
    // LITORAL: muito longo só dígitos sem pontos
    if (clean.length >= 20 && !clean.includes('.') && /^\d+$/.test(clean)) return 'LITORAL';
    // EURO: 7 dígitos ou com ".SDE###"
    if (/^\d{7}$/.test(clean) || (clean.includes('.') && /SDE\d{3}/.test(clean))) return 'EURO';
    // LITORAL: 5–8 dígitos
    if (/^\d{5,8}$/.test(clean) && !clean.includes('.')) return 'LITORAL';
    return 'DESCONHECIDO';
  }

  // **CORRIGIDO**: produto=8 dígitos, quantidade=5 dígitos (÷100), resto=controle
  static decodificarLitoralContinuo(codigoCompleto, bibliotecaDePara) {
    const codigoLimpo = codigoCompleto.replace(/^0+/, ''); // tira zeros iniciais
    if (codigoLimpo.length < 13) return null;

    const idProd = codigoLimpo.substring(0, 8);       // 8 dígitos
    const qtdString = codigoLimpo.substring(8, 13);   // 5 dígitos
    const quantidade = parseInt(qtdString, 10) / 100; // 59000 -> 59.00
    const controle = codigoLimpo.substring(13);       // resto

    const tentativas = [
      idProd,
      String(parseInt(idProd, 10)), // remove zeros à esquerda
      idProd.substring(0, 7),
      idProd.substring(0, 6),
      idProd.substring(0, 5)
    ];

    for (const cod of tentativas) {
      const produto = bibliotecaDePara[cod];
      if (produto) {
        return {
          codigoFornecedor: cod,
          quantidade,
          cor: '',
          codigoERP: produto.codigoERP,
          nomeERP: produto.nomeERP,
          fornecedor: produto.fornecedor || 'LITORAL',
          controle,
          padraoEncontrado: 'litoral_continuo'
        };
      }
    }
    return null;
  }

  static decodificarComPontos(codigoCompleto, bibliotecaDePara, mapeamentoCores) {
    const partes = codigoCompleto.split('.');
    if (partes.length < 3) return null;

    const idProd = partes[0].replace(/^0+/, '');        // ID
    const metrageMil = parseInt(partes[1], 10) || 0;    // metragem em mil
    const quantidade = metrageMil / 1000;

    let cor = this.extrairCor(partes, mapeamentoCores);

    const produto = bibliotecaDePara[idProd]
      || bibliotecaDePara[String(parseInt(idProd || '0', 10))];

    if (produto) {
      return {
        codigoFornecedor: idProd,
        quantidade,
        cor,
        codigoERP: produto.codigoERP,
        nomeERP: produto.nomeERP,
        fornecedor: produto.fornecedor || 'EURO',
        padraoEncontrado: 'com_pontos'
      };
    }
    return null;
  }

  static decodificarCodigoSimples(codigoCompleto, bibliotecaDePara) {
    const codigoLimpo = codigoCompleto.replace(/[^\d]/g, '');
    const tentativas = [
      codigoCompleto,
      codigoLimpo,
      codigoLimpo.replace(/^0+/, ''),
      String(parseInt(codigoLimpo || '0', 10))
    ];
    for (const cod of tentativas) {
      const produto = bibliotecaDePara[cod];
      if (produto) {
        return {
          codigoFornecedor: cod,
          quantidade: 0,
          cor: '',
          codigoERP: produto.codigoERP,
          nomeERP: produto.nomeERP,
          fornecedor: produto.fornecedor || 'DESCONHECIDO',
          padraoEncontrado: 'simples'
        };
      }
    }
    return null;
  }

  static extrairCor(partes, mapeamentoCores) {
    const sdeSection = partes.find(p => p.includes('SDE')) || '';
    if (!sdeSection) return '';

    const euro = sdeSection.match(/SDE(\d+)/);
    if (euro) {
      return this.mapearCorEurotextil(euro[1]);
    }

    const lit = sdeSection.match(/SDE([A-Z]+\d+)/);
    if (lit) {
      return this.decodificarCorLitoral(lit[1]);
    }
    return '';
  }

  static mapearCorEurotextil(corNum) {
    const coresEurotextil = {
      '100': 'branco','103': 'tinto','999': 'preto',
      '408': 'azul','500': 'cinza','200': 'verde',
      '300': 'amarelo','600': 'rosa','700': 'bege',
      '800': 'marrom','900': 'natural','001': 'natural','002': 'cru'
    };
    return coresEurotextil[corNum] || `cor${corNum}`;
  }

  static decodificarCorLitoral(corCodigo) {
    const coresLitoral = {
      'Z4005':'azul','AB12':'branco','PR99':'preto',
      'VD20':'verde','AM30':'amarelo','RS10':'rosa',
      'CZ05':'cinza','BG15':'bege'
    };
    return coresLitoral[corCodigo] || corCodigo.toLowerCase();
  }
}

window.CodigoDecoder = CodigoDecoder;
