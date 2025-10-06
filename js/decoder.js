// js/decoder.js - Módulo de Decodificação de Códigos
class CodigoDecoder {
    static obterMapaLookup(biblioteca) {
        if (!biblioteca || typeof biblioteca !== 'object') {
            return {};
        }

        if (!this._lookupCache) {
            this._lookupCache = new WeakMap();
        }

        if (this._lookupCache.has(biblioteca)) {
            return this._lookupCache.get(biblioteca);
        }

        const mapa = {};

        const registrar = (valor, produto) => {
            if (valor === undefined || valor === null) return;
            const textoOriginal = `${valor}`.trim();
            if (!textoOriginal) return;

            const variantes = new Set([textoOriginal, textoOriginal.toUpperCase()]);

            const semEspacos = textoOriginal.replace(/\s+/g, '');
            if (semEspacos) variantes.add(semEspacos);

            const semZeros = semEspacos.replace(/^0+/, '');
            if (semZeros) variantes.add(semZeros);

            const alfanumerico = semEspacos.replace(/[^0-9A-Za-z]/g, '');
            if (alfanumerico) {
                variantes.add(alfanumerico);
                const alfaSemZeros = alfanumerico.replace(/^0+/, '');
                if (alfaSemZeros) variantes.add(alfaSemZeros);
            }

            const somenteDigitos = semEspacos.replace(/\D+/g, '');
            if (somenteDigitos) {
                variantes.add(somenteDigitos);
                const digitosSemZeros = somenteDigitos.replace(/^0+/, '');
                if (digitosSemZeros) variantes.add(digitosSemZeros);
            }

            for (const variante of variantes) {
                if (!variante) continue;
                mapa[variante] = produto;
            }
        };

        for (const [chave, produto] of Object.entries(biblioteca)) {
            if (!produto || typeof produto !== 'object') continue;

            registrar(chave, produto);

            const camposRelevantes = [
                produto.codigoprodutofornecedor,
                produto.codigofornecedor,
                produto.codigoFornecedor,
                produto.cProd_norm,
                produto.cProd,
                produto.codigoERP,
                produto.codigoerp,
                produto.codigo,
                produto.variant_value,
                produto.variantValue,
                produto.cProduto
            ];

            for (const campo of camposRelevantes) {
                registrar(campo, produto);
            }

            if (Array.isArray(produto.keys)) {
                for (const chaveAlternativa of produto.keys) {
                    registrar(chaveAlternativa, produto);
                }
            }
        }

        this._lookupCache.set(biblioteca, mapa);
        return mapa;
    }

    static gerarVariacoesCodigo(codigo) {
        const variacoes = new Set();

        if (codigo === undefined || codigo === null) {
            return [];
        }

        const original = `${codigo}`;
        variacoes.add(original);

        const trimmed = original.trim();
        if (trimmed) variacoes.add(trimmed);

        const semEspacos = trimmed.replace(/\s+/g, '');
        if (semEspacos) variacoes.add(semEspacos);

        const semZeros = semEspacos.replace(/^0+/, '');
        if (semZeros) variacoes.add(semZeros);

        const alfanumerico = semEspacos.replace(/[^0-9A-Za-z]/g, '');
        if (alfanumerico) {
            variacoes.add(alfanumerico);
            const alfaSemZeros = alfanumerico.replace(/^0+/, '');
            if (alfaSemZeros) variacoes.add(alfaSemZeros);
        }

        const somenteDigitos = semEspacos.replace(/\D+/g, '');
        if (somenteDigitos) {
            variacoes.add(somenteDigitos);
            const digitosSemZeros = somenteDigitos.replace(/^0+/, '');
            if (digitosSemZeros) variacoes.add(digitosSemZeros);

            const limites = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
            for (const limite of limites) {
                if (somenteDigitos.length >= limite) {
                    variacoes.add(somenteDigitos.substring(0, limite));
                    variacoes.add(somenteDigitos.substring(somenteDigitos.length - limite));
                }
                if (digitosSemZeros.length >= limite) {
                    variacoes.add(digitosSemZeros.substring(0, limite));
                    variacoes.add(digitosSemZeros.substring(digitosSemZeros.length - limite));
                }
            }
        }

        return Array.from(variacoes).filter(Boolean);
    }

    static buscarProduto(biblioteca, codigo) {
        if (!biblioteca || typeof biblioteca !== 'object') {
            return null;
        }

        const mapaLookup = this.obterMapaLookup(biblioteca);
        const variacoes = this.gerarVariacoesCodigo(codigo);

        for (const variacao of variacoes) {
            if (!variacao) continue;

            if (biblioteca[variacao]) {
                return biblioteca[variacao];
            }

            if (mapaLookup[variacao]) {
                return mapaLookup[variacao];
            }
        }

        return null;
    }

    static normalizarProduto(produtoBruto) {
        if (!produtoBruto || typeof produtoBruto !== 'object') return null;

        const extrair = (fonte, chaves) => {
            for (const chave of chaves) {
                if (fonte[chave] !== undefined && fonte[chave] !== null && `${fonte[chave]}`.trim() !== '') {
                    return typeof fonte[chave] === 'string' ? fonte[chave].trim() : fonte[chave];
                }
            }
            return null;
        };

        const codigoERP = extrair(produtoBruto, ['codigoERP', 'codigoerp', 'codigoErp', 'codigo', 'codigo_erp']);
        const nomeERP = extrair(produtoBruto, ['nomeERP', 'nomeerp', 'descricao', 'descricao_erp']);
        const fornecedor = extrair(produtoBruto, ['fornecedor', 'fornecedor_grupo', 'fornecedorGrupo', 'fornecedorgrupo']);
        const produtoFornecedor = extrair(produtoBruto, ['produtoFornecedor', 'produtofornecedor', 'produto_fornecedor', 'descricaoFornecedor', 'descricao_fornecedor']);

        return {
            codigoERP: codigoERP || '',
            nomeERP: nomeERP || produtoFornecedor || '',
            fornecedor: fornecedor || '',
            produtoFornecedor: produtoFornecedor || nomeERP || ''
        };
    }

    static decodificar(codigoCompleto, bibliotecaDePara, mapeamentoCores = {}) {
        console.log('Decodificando código:', codigoCompleto);
        
        // Identificar fornecedor pelo padrão do código
        const fornecedor = this.identificarFornecedorPorPadrao(codigoCompleto);
        console.log('Fornecedor identificado:', fornecedor);
        
        // Aplicar decodificação específica por fornecedor
        let resultado = null;
        
        if (fornecedor === 'LITORAL' && !codigoCompleto.includes('.')) {
            // LITORAL com código contínuo (sem pontos)
            resultado = this.decodificarLitoralContinuo(codigoCompleto, bibliotecaDePara);
        } else if (codigoCompleto.includes('.')) {
            // Formato com pontos (EURO ou LITORAL)
            resultado = this.decodificarComPontos(codigoCompleto, bibliotecaDePara, mapeamentoCores, fornecedor);
        } else {
            // Código simples (pode ser qualquer fornecedor)
            resultado = this.decodificarCodigoSimples(codigoCompleto, bibliotecaDePara);
        }
        
        if (resultado) return resultado;
        
        // Fallback: retornar estrutura básica
        return {
            codigoFornecedor: codigoCompleto,
            quantidade: 0,
            cor: '',
            codigoERP: codigoCompleto,
            nomeERP: 'PRODUTO NÃO MAPEADO',
            fornecedor: 'DESCONHECIDO',
            produtoFornecedor: '',
            padraoEncontrado: 'nenhum'
        };
    }

    static identificarFornecedorPorPadrao(codigo) {
        codigo = codigo.trim();

        // EURO: códigos contínuos de 40–46 dígitos (sem pontos)
        if (/^\d{40,46}$/.test(codigo)) {
            return 'EURO';
        }

        // LITORAL: códigos de 30–39 dígitos (sem pontos)
        if (/^\d{30,39}$/.test(codigo)) {
            return 'LITORAL';
        }

        // EURO com pontos e padrão SDE###
        if (codigo.includes('.') && /SDE\d{3}/.test(codigo)) {
            return 'EURO';
        }

        // LITORAL simples 5–8 dígitos sem pontos
        if (/^\d{5,8}$/.test(codigo) && !codigo.includes('.')) {
            return 'LITORAL';
        }

        return 'DESCONHECIDO';
    }

    static decodificarLitoralContinuo(codigoCompleto, bibliotecaDePara) {
        // Formato LITORAL sem pontos: 000002003000500005900025101300936
        // Estrutura correta: [zeros][produto 8 dígitos][quantidade 5 dígitos][controle...]

        const codigoLimpo = String(codigoCompleto || '').replace(/^0+/, '');
        if (codigoLimpo.length < 13) return null;

        // Extrair produto (primeiros 8 dígitos)
        const idProd = codigoLimpo.substring(0, 8);

        // Demais blocos são registrados em grupos de 5 dígitos.
        // Em alguns códigos o primeiro bloco é apenas controle, por isso
        // localizamos o primeiro bloco com valor > 0 para usar como quantidade.
        const blocos = [];
        for (let i = 8; i < codigoLimpo.length; i += 5) {
            blocos.push(codigoLimpo.substring(i, i + 5));
        }

        let quantidade = 0;
        for (const bloco of blocos) {
            if (!bloco) continue;
            const valor = parseInt(bloco, 10);
            if (Number.isFinite(valor) && valor > 0) {
                quantidade = valor / 1000;
                break;
            }
        }

        // Tentar várias variações do código do produto
        const codigosParaTentar = new Set([idProd]);
        const numeroId = parseInt(idProd, 10);
        if (!Number.isNaN(numeroId)) {
            codigosParaTentar.add(String(numeroId));
        }

        [7, 6, 5].forEach(tamanho => {
            if (idProd.length >= tamanho) {
                codigosParaTentar.add(idProd.substring(0, tamanho));
            }
        });

        const variacoes = new Set();
        codigosParaTentar.forEach(codigo => {
            this.gerarVariacoesCodigo(codigo).forEach(v => variacoes.add(v));
        });

        for (let codigoTeste of variacoes) {
            const produto = this.buscarProduto(bibliotecaDePara, codigoTeste);
            if (produto) {
                const infoProduto = this.normalizarProduto(produto);
                if (infoProduto) {
                    return {
                        codigoFornecedor: codigoTeste,
                        quantidade,
                        cor: '',
                        codigoERP: infoProduto.codigoERP || codigoTeste,
                        nomeERP: infoProduto.nomeERP || infoProduto.produtoFornecedor || 'PRODUTO NÃO MAPEADO',
                        fornecedor: infoProduto.fornecedor || 'DESCONHECIDO',
                        produtoFornecedor: infoProduto.produtoFornecedor || '',
                        padraoEncontrado: 'litoral_continuo'
                    };
                }
            }
        }
        const codigoFallback = idProd.replace(/^0+/, '') || idProd || codigoCompleto;
        return {
            codigoFornecedor: codigoFallback,
            quantidade,
            cor: '',
            codigoERP: codigoFallback,
            nomeERP: 'PRODUTO NÃO MAPEADO',
            fornecedor: 'LITORAL',
            produtoFornecedor: '',
            padraoEncontrado: 'litoral_continuo'
        };
    }

    static decodificarComPontos(codigoCompleto, bibliotecaDePara, mapeamentoCores, fornecedorInferido = 'DESCONHECIDO') {
        // Formato com pontos: <id_prod>.<metragem_em_mil>.000SDE<###>.<PO######>.<SEQ#####>
        const partes = codigoCompleto.split('.');

        if (partes.length >= 3) {
            const idProdOriginal = partes[0];
            const idProd = idProdOriginal.replace(/^0+/, '');

            const metrageMil = parseInt(partes[1]) || 0;
            const quantidade = metrageMil / 1000; // Divisor padrão 1000

            const cor = this.extrairCor(partes, mapeamentoCores);

            const variacoesCodigo = new Set([
                ...this.gerarVariacoesCodigo(idProd),
                ...this.gerarVariacoesCodigo(idProdOriginal)
            ]);
            let produtoEncontrado = null;
            let codigoEncontrado = idProd;

            for (const variacao of variacoesCodigo) {
                const produto = this.buscarProduto(bibliotecaDePara, variacao);
                if (produto) {
                    produtoEncontrado = produto;
                    codigoEncontrado = variacao;
                    break;
                }
            }

            if (produtoEncontrado) {
                const infoProduto = this.normalizarProduto(produtoEncontrado);
                if (!infoProduto) return null;
                return {
                    codigoFornecedor: codigoEncontrado,
                    quantidade,
                    cor,
                    codigoERP: infoProduto.codigoERP || idProd,
                    nomeERP: infoProduto.nomeERP || infoProduto.produtoFornecedor || 'PRODUTO NÃO MAPEADO',
                    fornecedor: infoProduto.fornecedor || 'DESCONHECIDO',
                    produtoFornecedor: infoProduto.produtoFornecedor || '',
                    padraoEncontrado: 'com_pontos'
                };
            }

            const codigoFallback = idProd || idProdOriginal;
            return {
                codigoFornecedor: codigoFallback,
                quantidade,
                cor,
                codigoERP: codigoFallback,
                nomeERP: 'PRODUTO NÃO MAPEADO',
                fornecedor: fornecedorInferido || 'DESCONHECIDO',
                produtoFornecedor: '',
                padraoEncontrado: 'com_pontos'
            };
        }

        return null;
    }

    static decodificarCodigoSimples(codigoCompleto, bibliotecaDePara) {
        // Limpar código - manter apenas dígitos para busca
        const codigoLimpo = codigoCompleto.replace(/[^\d]/g, '');
        
        // Lista de códigos para tentar
        const codigosParaTentar = new Set([
            codigoCompleto,
            codigoLimpo,
            codigoLimpo.replace(/^0+/, '')
        ]);

        const numero = parseInt(codigoLimpo, 10);
        if (!Number.isNaN(numero)) {
            codigosParaTentar.add(String(numero));
        }

        const variacoes = new Set();
        for (let codigo of codigosParaTentar) {
            if (!codigo) continue;
            this.gerarVariacoesCodigo(codigo).forEach(v => variacoes.add(v));
        }

        for (let codigo of variacoes) {
            if (!codigo) continue;
            const produto = this.buscarProduto(bibliotecaDePara, codigo);
            if (produto) {
                const infoProduto = this.normalizarProduto(produto);
                if (!infoProduto) continue;
                return {
                    codigoFornecedor: codigo,
                    quantidade: 0,
                    cor: '',
                    codigoERP: infoProduto.codigoERP || codigo,
                    nomeERP: infoProduto.nomeERP || infoProduto.produtoFornecedor || 'PRODUTO NÃO MAPEADO',
                    fornecedor: infoProduto.fornecedor || 'DESCONHECIDO',
                    produtoFornecedor: infoProduto.produtoFornecedor || '',
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
        console.group('🔍 Debug Decodificação:', codigo);
        console.log('📌 Código original:', codigo);
        console.log('📏 Tamanho:', codigo.length);
        console.log('🔢 Código limpo (só números):', codigo.replace(/[^\d]/g, ''));
        console.log('📍 Tem pontos:', codigo.includes('.'));
        console.log('🏷️ Tem SDE:', codigo.includes('SDE'));
        
        // Análise específica para código contínuo (LITORAL)
        if (codigo.length >= 20 && !codigo.includes('.')) {
            const codigoLimpo = codigo.replace(/^0+/, '');
            console.log('🔄 Código sem zeros iniciais:', codigoLimpo);
            
            const idProd = codigoLimpo.substring(0, 8);
            const qtdString = codigoLimpo.substring(8, 16);
            const quantidade = parseInt(qtdString) / 100;
            
            console.log('🆔 ID Produto extraído:', idProd);
            console.log('📦 Quantidade extraída:', quantidade, 'MT');
            
            console.log('🔍 Testando variações do código:');
            [idProd, parseInt(idProd).toString(), idProd.substring(0, 5), idProd.substring(0, 6)].forEach(teste => {
                console.log(`  - ${teste}:`, bibliotecaDePara[teste] ? '✅ ENCONTRADO' : '❌ não encontrado');
            });
        }
        
        console.log('🏢 Fornecedor identificado:', this.identificarFornecedor(codigo));
        console.log('✔️ Formato válido:', this.validarFormato(codigo));
        
        if (codigo.includes('.')) {
            const partes = codigo.split('.');
            console.log('📦 Partes do código:', partes);
            
            if (partes.length > 0) {
                const idProd = partes[0].replace(/^0+/, '');
                console.log('🆔 ID Produto extraído:', idProd);
                console.log('📚 Produto na biblioteca:', bibliotecaDePara[idProd] ? '✅ SIM' : '❌ NÃO');
            }
        }
        
        // Testar busca direta
        const codigoLimpo = codigo.replace(/[^\d]/g, '');
        console.log('🔎 Busca direta na biblioteca:');
        console.log('  - Código original:', bibliotecaDePara[codigo] ? '✅ ENCONTRADO' : '❌ não encontrado');
        console.log('  - Código limpo:', bibliotecaDePara[codigoLimpo] ? '✅ ENCONTRADO' : '❌ não encontrado');
        console.log('  - Sem zeros:', bibliotecaDePara[codigoLimpo.replace(/^0+/, '')] ? '✅ ENCONTRADO' : '❌ não encontrado');
        
        console.groupEnd();
    }

    // Validar resultado da decodificação
    static validarResultado(resultado) {
        if (!resultado) return false;
        
        const camposObrigatorios = ['codigoFornecedor', 'codigoERP', 'nomeERP'];
        return camposObrigatorios.every(campo => resultado[campo]);
    }
}

// Disponibilizar globalmente (browser) ou via module.exports (Node)
if (typeof window !== 'undefined') {
    window.CodigoDecoder = CodigoDecoder;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CodigoDecoder;
}
