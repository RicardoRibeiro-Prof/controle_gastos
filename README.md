# Controle de Gastos

App simples de controle de gastos com dashboard, login e conexão com Supabase.

## Arquivos

- `index.html`
- `style.css`
- `script.js`
- `app-icon.png`

## Banco de dados

O app usa Supabase. As tabelas necessárias são:

- `usuarios`
- `gastos`
- `limites`

Login inicial criado no SQL:

- usuário: `admin`
- senha: `1234`

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie os arquivos `index.html`, `style.css` e `script.js`.
3. Vá em **Settings > Pages**.
4. Em **Branch**, selecione `main` e `/root`.
5. Clique em **Save**.

## Observação importante

Esta versão usa login simples salvo na tabela `usuarios`. Para um app definitivo, o ideal é trocar depois para Supabase Auth e ativar regras de segurança RLS.


## Cadastro e alteração de acesso

Na primeira utilização, clique em **Criar meu primeiro acesso** e cadastre nome, usuário e senha.
Depois de entrar no sistema, acesse **Configurações > Meu acesso** para alterar nome, usuário ou senha.

As informações são salvas na tabela `usuarios` do Supabase.
