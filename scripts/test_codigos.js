#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CodigoDecoder = require('../js/decoder.js');

const carregarDePara = () => {
    const arquivoDePara = path.join(__dirname, '..', 'data', 'depara.json');
    const conteudo = fs.readFileSync(arquivoDePara, 'utf8');
    const dados = JSON.parse(conteudo);

    if (dados && typeof dados === 'object' && !Array.isArray(dados)) {
        const candidatos = [dados.produtos, dados.lookup, dados.mapa, dados.data, dados];
        const biblioteca = candidatos.find((opcao) => opcao && typeof opcao === 'object' && !Array.isArray(opcao)) || {};
        return {
            biblioteca,
            cores: dados.mapeamentoCores || {}
        };
    }

    if (Array.isArray(dados)) {
        const mapa = {};
        for (const item of dados) {
            if (!item) continue;
            const codigoFornecedor = String(item.codigoprodutofornecedor ?? '')
                .replace(/\D+/g, '')
                .replace(/^0+/, '');
            if (!codigoFornecedor) continue;
            const codigoERP = item.codigoerp != null ? String(item.codigoerp).split('.')[0] : null;
            const fornecedor = String(item.fornecedor_grupo || '').trim().toUpperCase();
            mapa[codigoFornecedor] = {
                codigoERP,
                nomeERP: item.nomeerp ?? null,
                fornecedor: fornecedor || null,
                produtoFornecedor: item.produtofornecedor ?? null,
                ncm: item.ncm ?? null,
                unidade: item.unidademedida ?? null
            };
        }
        return {
            biblioteca: mapa,
            cores: {}
        };
    }

    throw new Error('Formato de DEPARA não suportado');
};

const testarCodigos = (titulo, codigos, biblioteca, cores = {}) => {
    console.log(`\n=== ${titulo} ===`);
    for (const codigo of codigos) {
        const resultado = CodigoDecoder.decodificar(codigo, biblioteca, cores);
        console.log(`\nCódigo: ${codigo}`);
        console.log(JSON.stringify(resultado, null, 2));
    }
};

const main = () => {
    const { biblioteca, cores } = carregarDePara();

    const codigosLitoral = [
        '000000326027300000067000024160901035',
        '000000601000010000050000024154400746',
        '000000571400090000050000024135300687',
        '000001386000010000054200025102100927',
        '000000203690000061000023147300806'
    ].filter(Boolean);

    const codigosEuro = [
        '0000000150100.0000100000.000SDE0005.242248.01226',
        '0000001385545.0000050000.000SDE223.241253.00711',
        '0000000147100.0000050000.000SDE100.242375.00509',
        '0000000150973.0000057000.000SDE100.240264.00075',
        '1113103300100.0000056300.000SDE903.251356.00913',
        '3058103300100.0000058800.000SDE903.251117.00882',
        '0000000150100.0000065000.000SDE302.242455.00251',
        '0000000150100.0000065000.000SDE302.242455.00251',
        '5221103150964.0000061000.000SDE200.250196.01019',
        '0000000255100.0000050000.000SDE100.241966.01537'
    ];

    testarCodigos('LITORAL', codigosLitoral, biblioteca, cores);
    testarCodigos('EURO', codigosEuro, biblioteca, cores);
};

if (require.main === module) {
    main();
}
