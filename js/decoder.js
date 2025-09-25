// js/decoder.js - Módulo de Decodificação de Códigos
class CodigoDecoder {
    static decodificar(codigoCompleto, bibliotecaDePara, mapeamentoCores = {}) {
        console.log('Decodificando código:', codigoCompleto);
        
        // Tentar padrão completo primeiro
        const resultadoCompleto = this.decodificarPadraoCompleto(codigoCompleto, bibliotecaDePara, mapeamentoCores);
        if (resultadoCompleto) return resultadoCompleto;
        
        // Tentar código simples
        const resultadoSimples = this.decodificarCodigoSimples(codigoCompleto, bibliotecaDePara);
        if (resultadoSimples) return resultadoSimples;
        
        // Se não encontrou, retornar estrutura básica
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

    static decodificarPadraoCompleto(codigoCompleto, bibliotecaDePara, mapeamentoCores) {
        // Padrão: <id_prod>.<metragem_em_mil>.000SDE<###>.<PO######>.<SEQ#####>
        const partes = codigoCompleto.split('.');
        
        if (partes.length >= 3) {
            // Extrair ID do produto (remover zeros à esquerda)
            const idProd = partes[0].replace(/^0+/, '');
            
            // Extrair metragem
            const metrageMil = parseInt(partes[1]) || 0;
            const quantidade = metrageMil / 1000; // Divisor padrão 1000
            
            // Buscar cor na seção SDE
            let cor = this.extrairCor(partes, mapeamentoCores);
            
            // Buscar produto na biblioteca
            const produto = bibliotecaDePara[idProd];
            
            return {
                codigoFornecedor: idProd,
                quantidade: quantidade,
                cor: cor,
                codigoERP: produto ? produto.codigoERP : idProd,
                nomeERP: produto ? produto.nomeERP : 'PRODUTO NÃO MAPEADO',
                fornecedor: produto ? produto.fornecedor : 'DESCONHECIDO',
                padraoEncontrado: 'completo'
            };
        }
        
        return null;
    }

    static decodificarCodigoSimples(codigoCompleto, bibliotecaDePara) {
        // Limpar código - manter apenas dígitos para busca
        const codigoLimpo = codigoCompleto.replace(/[^\d]/g, '');
        
        // Lista de códigos para tentar
        const codigosParaTentar = [
            codigoCompleto,           // Código original
            codigoLimpo,              // Só números
            codigoLimpo.replace(/^0+/, ''), // Sem zeros à esquerda
            parseInt(codigoLimpo).toString() // Como número
        ];
        
        for (let codigo of codigosParaTentar) {
            const produto = bibliotecaDePara[codigo];
            if (produto) {
                return {
                    codigoFornecedor: codigo,
                    quantidade: 0, // Será preenchido manualmente
                    cor: '',
                    codigoERP: produto.codigoERP,
                    nomeERP: produto.nomeERP,
                    fornecedor: produto.fornecedor,
                    produtoFornecedor: produto.produtoFornecedor,
                    padraoEncontrado: 'simples'
                };
            }
        }
        
        return null;
    }

    static extrairCor(partes, mapeamentoCores) {
        // Buscar cor na seção SDE
        const sdeSection = partes.find(parte => parte.includes('SDE')) || '';
        
        if (sdeSection) {
            // Padrão EUROTEXTIL: SDE999, SDE103, etc.
            const sdeMatch = sdeSection.match(/SDE(\d+)/);
            if (sdeMatch) {
                const corNum = sdeMatch[1];
                return this.mapearCorEurotextil(corNum);
            }
            
            // Padrão LITORAL: SDEZ4005, SDEAB12, etc. 
            const sdeLitoralMatch = sdeSection.match(/SDE([A-Z]+\d+)/);
            if (sdeLitoralMatch) {
                const corCodigo = sdeLitoralMatch[1];
                return this.decodificarCorLitoral(corCodigo);
            }
        }
        
        return '';
    }

    static mapearCorEurotextil(corNum) {
        // Mapeamento específico EUROTEXTIL
        const coresEurotextil = {
            '100': 'branco',
            '103': 'tinto',
            '999': 'preto',
            '408': 'azul',
            '500': 'cinza',
            '200': 'verde',
            '300': 'amarelo',
            '600': 'rosa',
            '700': 'bege',
            '800': 'marrom',
            '900': 'natural',
            '001': 'natural',
            '002': 'cru'
        };
        
        return coresEurotextil[corNum] || `cor${corNum}`;
    }

    static decodificarCorLitoral(corCodigo) {
        // Mapear códigos específicos do LITORAL
        const coresLitoral = {
            'Z4005': 'azul',
            'AB12': 'branco', 
            'PR99': 'preto',
            'VD20': 'verde',
            'AM30': 'amarelo',
            'RS10': 'rosa',
            'CZ05': 'cinza',
            'BG15': 'bege'
        };
        
        return coresLitoral[corCodigo] || corCodigo.toLowerCase();
    }

    // Validar se código está no formato esperado
    static validarFormato(codigo) {
        // EUROTEXTIL: números de 7 dígitos ou formato completo com pontos
        const formatoEuro = /^\d{7}$|^\d+\.\d+\.000SDE\d+\.\d+\.\d+$/;
        
        // LITORAL: números de 5-8 dígitos ou formato completo
        const formatoLitoral = /^\d{5,8}$|^\d+\.\d+\.000SDE[A-Z]+\d+\.\d+\.\d+$/;
        
        return formatoEuro.test(codigo) || formatoLitoral.test(codigo);
    }

    // Identificar fornecedor pelo padrão do código
    static identificarFornecedor(codigo) {
        // Códigos EUROTEXTIL são tipicamente 7 dígitos
        if (/^\d{7}$/.test(codigo) || codigo.includes('SDE') && /SDE\d{3}/.test(codigo)) {
            return 'EURO';
        }
        
        // Códigos LITORAL são variados (5-8 dígitos) ou com letras na cor
        if (/^\d{5,8}$/.test(codigo) || codigo.includes('SDE') && /SDE[A-Z]+/.test(codigo)) {
            return 'LITORAL';
        }
        
        return 'DESCONHECIDO';
    }

    // Extrair metragem de códigos conhecidos (para fallback)
    static extrairMetragemFallback(codigo, fornecedor) {
        const padroesPorFornecedor = {
            'EURO': {
                '4700103': 50.0,
                '5038103': 35.8,
                '732100': 45.2,
                '732103': 32.5,
                '1468100': 58.8,
                '1113103': 42.0,
                '3058103': 38.5
            },
            'LITORAL': {
                '20000': 67.2,
                '30000': 42.5,
                '55780000': 42.3,
                '60870000': 28.7,
                '1330069': 59.5,
                '1710000': 35.0,
                '60920000': 31.2
            }
        };
        
        const padroes = padroesPorFornecedor[fornecedor];
        return padroes ? padroes[codigo] : null;
    }

    // Tentar extrair informações do nome do produto fornecedor
    static extrairInfoDoProduto(nomeProduto) {
        if (!nomeProduto) return {};
        
        const info = {};
        
        // Extrair largura (ex: 1.50L, 3.00L)
        const larguraMatch = nomeProduto.match(/(\d+[\.,]\d+)L/);
        if (larguraMatch) {
            info.largura = parseFloat(larguraMatch[1].replace(',', '.'));
        }
        
        // Extrair composição (ex: 100% POLYESTER)
        const composicaoMatch = nomeProduto.match(/\d+%\s*[A-Z]+/g);
        if (composicaoMatch) {
            info.composicao = composicaoMatch.join(' ');
        }
        
        // Extrair gramatura (ex: 109GR/M2)
        const gramaturaMatch = nomeProduto.match(/(\d+)GR\/M2?/);
        if (gramaturaMatch) {
            info.gramatura = parseInt(gramaturaMatch[1]);
        }
        
        return info;
    }

    // Função utilitária para debug
    static debug(codigo, bibliotecaDePara) {
        console.group('Debug Decodificação:', codigo);
        console.log('Código original:', codigo);
        console.log('Código limpo (só números):', codigo.replace(/[^\d]/g, ''));
        console.log('Tem pontos:', codigo.includes('.'));
        console.log('Tem SDE:', codigo.includes('SDE'));
        console.log('Fornecedor identificado:', this.identificarFornecedor(codigo));
        console.log('Formato válido:', this.validarFormato(codigo));
        
        if (codigo.includes('.')) {
            const partes = codigo.split('.');
            console.log('Partes do código:', partes);
            
            if (partes.length > 0) {
                const idProd = partes[0].replace(/^0+/, '');
                console.log('ID Produto extraído:', idProd);
                console.log('Produto na biblioteca:', bibliotecaDePara[idProd] ? 'SIM' : 'NÃO');
            }
        }
        
        // Testar busca direta
        const codigoLimpo = codigo.replace(/[^\d]/g, '');
        console.log('Busca direta na biblioteca:');
        console.log('- Código original:', bibliotecaDePara[codigo] ? 'ENCONTRADO' : 'NÃO');
        console.log('- Código limpo:', bibliotecaDePara[codigoLimpo] ? 'ENCONTRADO' : 'NÃO');
        console.log('- Sem zeros:', bibliotecaDePara[codigoLimpo.replace(/^0+/, '')] ? 'ENCONTRADO' : 'NÃO');
        
        console.groupEnd();
    }

    // Validar resultado da decodificação
    static validarResultado(resultado) {
        if (!resultado) return false;
        
        const camposObrigatorios = ['codigoFornecedor', 'codigoERP', 'nomeERP'];
        return camposObrigatorios.every(campo => resultado[campo]);
    }
}

// Disponibilizar globalmente
window.CodigoDecoder = CodigoDecoder;
