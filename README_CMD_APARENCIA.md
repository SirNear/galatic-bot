# 🧬 Sistema de Aparências e Versos - Guia do Usuário

O comando `aparencia` (ou `/aparencia`) é a ferramenta central para gerenciar a disponibilidade de "faceclaims" (aparências de personagens) e universos (versos) dentro do RPG. Ele conecta o Discord diretamente a uma planilha Google Sheets para garantir que não haja duplicatas.

## 📋 Funcionalidades Principais

1. **Verificação de Disponibilidade**: Pesquisa se um nome ou universo já está em uso.
2. **Busca Inteligente**: Encontra resultados similares caso a busca exata não retorne nada (ex: erro de digitação).
3. **Registro Automático**: Permite registrar novos itens diretamente pelo Discord se estiverem livres.
4. **Gerenciamento**: Permite que donos do registro ou administradores editem ou excluam entradas.
5. **Navegação**: Sistema de páginas para visualizar múltiplos resultados.

---

## 🚀 Como Usar

### 1. Iniciando o Comando
Você pode usar o comando de duas formas:

*   **Prefixo**: `g!aparencia` (ou aliases: `g!ap`, `g!verso`, `g!pesquisarap`)
*   **Slash Command**: `/aparencia [tipo]`

Ao iniciar, o bot apresentará um painel de navegação perguntando o que você deseja verificar:
*   **🟦 APARÊNCIA**: Para buscar personagens específicos (ex: "Goku", "Naruto").
*   **🟩 VERSO**: Para buscar universos inteiros (ex: "Dragon Ball", "Naruto Shippuden").

### 2. O Processo de Busca

1.  **Seleção**: Clique no botão correspondente (Aparência ou Verso).
2.  **Input**: O bot pedirá para você digitar o nome no chat. Você tem 15 segundos.
3.  **Processamento**: O sistema normaliza o texto (remove acentos, minúsculas) e busca na planilha.

### 3. Resultados da Busca

#### Cenário A: Item Encontrado (ou Similares)
O bot exibirá uma lista paginada com os detalhes:
*   **Aparência**: Nome do personagem.
*   **Universo**: De onde ele vem.
*   **Personagem**: Nome do personagem no RPG.
*   **Jogador**: Quem registrou (Dono).

**Botões de Ação:**
*   `⏪` `⏩`: Navegar entre páginas de resultados.
*   `➕`: Iniciar um novo registro (caso o que você quer não seja exatamente o que foi achado).
*   `✏️` (Editar) / `🗑️` (Excluir): Aparecem apenas se você for o **dono** do registro ou **Administrador**.
*   `👤` (Apenas em Versos): Lista todas as aparências registradas naquele universo específico.

#### Cenário B: Nada Encontrado
Se não houver conflitos, o bot informará que o nome está **Livre para Registro** e oferecerá um botão para registrar imediatamente.

---

## 📝 Sistema de Registro

Ao clicar em `➕` ou no botão de registro direto:

1.  Um **Formulário (Modal)** abrirá na tela.
2.  Preencha os campos solicitados:
    *   **Aparência**: Nome, Universo, Personagem.
    *   **Verso**: Nome, % de Uso.
3.  **Validação**:
    *   O sistema verifica se você tem "tokens" de aparência disponíveis (se aplicável).
    *   Verifica se você possui universos com uso incompleto (bloqueio de novos registros até completar o uso do verso anterior).
4.  **Conclusão**: Os dados são salvos instantaneamente na planilha Google Sheets.

---

## ⚙️ Gerenciamento (Edição e Exclusão)

Se você encontrar um registro que lhe pertence (o nome do "Jogador" na planilha bate com seu registro no banco de dados do bot):

*   **Editar (`✏️`)**: Abre um formulário para corrigir Nome, Universo ou Personagem.
*   **Excluir (`🗑️`)**: Remove a linha da planilha permanentemente após confirmação.

> **Nota**: Administradores têm permissão para editar ou excluir qualquer registro, independente do dono.

---

## 🔍 Detalhes Técnicos (Resumo)

*   **Similaridade**: O bot usa um algoritmo (Levenshtein) para detectar nomes parecidos. Ex: Buscar "Naruto" pode achar "Naruto Uzumaki".
*   **Planilha**: Os dados são lidos das abas `INDIVIDUAIS` (Aparências) e `UNIVERSO` (Versos).
*   **Timeout**: Os menus de navegação expiram após 60 segundos de inatividade para economizar recursos.