# 🛠️ Guia do Desenvolvedor: Comando Aparencia

Este documento destina-se a programadores iniciantes que desejam entender como o comando `aparencia.js` e seu módulo auxiliar `registro.js` funcionam "por baixo do capô".

## 📂 Estrutura de Arquivos

*   `commands/rpg/aparencia.js`: Arquivo principal. Contém a lógica de interação com o usuário, coletores de mensagem e navegação.
*   `api/APARENCIA/registro.js`: Módulo auxiliar. Contém a lógica de formulários (Modais), validação de regras de negócio e gravação na planilha.

---

## 📚 Conceitos Chave Utilizados

### 1. Herança de Classe (`extends Command`)
O comando é uma **Classe** que herda de uma estrutura base `Command`.
*   **Constructor**: Define o nome, categoria, permissões e opções do Slash Command.
*   **Run/Execute**: Métodos chamados quando o usuário digita o comando (prefixo ou barra).

### 2. Google Sheets API (`googleapis`)
O bot não usa um banco de dados SQL/NoSQL para as aparências, ele usa uma planilha do Google como "banco de dados".
*   **Leitura (`values.get`)**: Usada para buscar linhas e verificar disponibilidade.
*   **Escrita (`values.update`/`append`)**: Usada para registrar novos itens ou editar existentes.
*   **Autenticação**: Feita via arquivo JSON de credenciais (`regal-primacy...json`).

### 3. Coletores (Collectors)
O Discord.js funciona com eventos. Para esperar uma resposta do usuário (como digitar o nome da aparência), usamos coletores:
*   `createMessageCollector`: Espera uma mensagem de texto do usuário.
*   `createMessageComponentCollector`: Espera um clique em botão ou seleção de menu.

### 4. Algoritmo de Levenshtein
Função `calcularDistanciaLev(a, b)` no final do arquivo.
*   **O que faz**: Calcula quão diferentes são duas palavras.
*   **Uso**: Permite que o bot encontre "Goku" mesmo se o usuário digitar "Goko" ou se o nome na planilha for "Son Goku".

---

## 🧠 Fluxo de Execução do Código

### Passo 1: Entrada (`run` ou `execute`)
1.  O bot verifica se o usuário passou argumentos (ex: `g!aparencia goku`).
2.  Se sim, pula para a busca direta.
3.  Se não, exibe um **Embed** com botões (Aparência/Verso) e cria um coletor para esperar o clique.

### Passo 2: Processamento (`processarSelecaoAparencia`)
Esta é a função "cérebro" do comando.
1.  Identifica qual botão foi clicado.
2.  Inicia um **Contador** (visual) e um **MessageCollector**.
3.  Quando o usuário digita o nome:
    *   Para o contador.
    *   Chama `buscarAparencias`.

### Passo 3: Busca (`buscarAparencias`)
1.  Baixa todas as linhas da planilha relevante.
2.  Normaliza o texto (remove acentos, deixa minúsculo) com `normalizeText`.
3.  Compara o texto digitado com cada linha da planilha usando `includes` e Levenshtein.
4.  Retorna um array de objetos encontrados.

### Passo 4: Exibição e Navegação
1.  Cria um Array de `EmbedBuilder` (um para cada resultado).
2.  Cria botões de navegação (`navRow`) dinamicamente:
    *   Verifica se o usuário é dono do registro (comparando com o banco de dados MongoDB `client.database.userData`).
    *   Se for dono ou Admin, adiciona botões de Editar/Excluir.
3.  Usa um `ComponentCollector` para lidar com "Próximo", "Anterior", "Registrar".

### Passo 5: Registro (`handleRegistro` em `registro.js`)
Se o usuário decidir registrar:
1.  Exibe um **Modal** (`showModal`) com campos de texto.
2.  Aguarda o envio (`awaitModalSubmit`).
3.  **Validação**:
    *   Verifica se o usuário tem "pendências" (versos com uso < 100%).
    *   Consome tokens de aparência se necessário.
4.  Grava na próxima linha vazia da planilha.

---

## ⚠️ Pontos de Atenção para Manutenção

1.  **IDs Fixos**: O código contém IDs de canais e planilhas "hardcoded" (fixos no código).
    *   *Dica*: Ao mudar de servidor ou planilha, procure por strings como `"17L8NZsgH5..."` ou `"1409063037..."`.
2.  **Tratamento de Erros**:
    *   Sempre use `try/catch` ao chamar a API do Google, pois ela pode falhar (timeout, cota excedida).
    *   Verifique se `messageToEdit` ainda existe antes de tentar editá-la.
3.  **Normalização**:
    *   Sempre use `normalizeText` antes de comparar nomes para evitar duplicatas por causa de acentos ou maiúsculas.

## 🧩 Exemplo de Snippet Explicado

```javascript
// Função que cria a paginação
const navRow = async (idx) => {
    // ...
    // Verifica no banco de dados quem é o usuário
    const userDb = await this.client.database.userData.findOne({ uid: author.id, ... });
    
    // Compara o nome do jogador na planilha com o do banco
    const isOwner = jogadorPlanilhaNorm === jogadorDBNorm;
    
    // Se for dono, adiciona botões extras
    if (isOwner || isAdmin) {
        components.push(
            new ButtonBuilder().setCustomId(`edit...`), // Botão Editar
            new ButtonBuilder().setCustomId(`delete...`) // Botão Deletar
        );
    }
    // ...
};
```

Este trecho mostra como o bot decide dinamicamente quais botões mostrar baseados na permissão do usuário.