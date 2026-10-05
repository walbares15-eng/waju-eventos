---
name: waju-eventos-project
description: Projeto do aplicativo PDV WAJU EVENTOS para gerenciamento de eventos e vendas de fichas.
metadata:
  type: project
---
Projeto do aplicativo PDV WAJU EVENTOS, pronto para ser entregue a um cliente e rodar em uma maquininha de cartão Cielo (Smart POS/Android).

### O que foi feito:
1. **Renomeação do Projeto:** Renomeado para **WAJU EVENTOS** (`package.json`, `index.html`, `manifest.json` e cabeçalho do App).
2. **Backup & Restauração:** Implementada funcionalidade no módulo Admin para Exportar (JSON) e Restaurar Backups completas do banco de dados local.
3. **Reset Geral de Dados:** Botão de ação mestre com proteção via PIN para limpar todos os dados antes de um novo evento.
4. **Layout Responsivo Touch-first:** CSS reformulado com `App.css` otimizado para telas sensíveis ao toque (Cielo Smart POS / Celulares / Tablets) na vertical.
5. **Impressão Otimizada:** CSS `@media print` configurado para focar apenas nos recibos em bobinas térmicas de 80mm/58mm.
6. **Prevenção de Duplo Clique:** Tratamento do processo de finalização da venda para evitar duplicidade em telas sensíveis ao toque de maquininhas.
