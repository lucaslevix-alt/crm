Facilitar a organização de registros.

Quando o SDR for registrar uma reunião agendada, o registro vai pedir para preencher 2 campos + squad automático:

- Origem do lead (ex.: Meta Ads, indicação, evento)
- Grupo WPP
- Squad (preencherá automáticamente de acordo com o sdr, pois ele já estará vinculado dentro de um squad)

Teremos um menu chamado "agenda" onde mostrará os agendamentos, e o closer poderá ver os do seu squad para selecionar e colocar como "realizada" ou até mesmo "venda".

Caso o closer selecione um agendamento e altere para venda, automáticamente esse evento também já marcará como realizada.

Selecionando como venda, continuam os campos que o closer precisará preencher como: Valor da venda, forma de pagamento; produtos.

Esses registros no geral continuam marcando nos dashboards de venda e meta ads.

A agenda não será vinculada ao google, será apenas uma organização interna

Qual é o objetivo geral:

Para o SDR
- Ele entra no sistema, clica no botão rápido e registra que agendou uma reunião, preenchendo a origem do lead e o nome do grupo de whatsapp.

Esse registro já fica marcado no menu "agenda".

Para o CLOSER
- Ele entrará no menu "agenda" e conseguirá ver o que seu SDR já agendou para ele, mostrando somente o "nome do grupo de whatsapp". O closer terá como opção tornar aquele registro uma reunião realizada ou uma venda.

Se ele marcar como reunião realizada, contará automáticamente como realizada para o SDR que registrou e para o closer também.

Por fim, o SDR teria somente o trabalho de registrar o agendamento, o closer, de alterar status para "realizada" ou "venda" e preencher os dados necessários quando acontecer a venda.

Cada closer/sdr só consegue visualizar os eventos do seu squad no menu "agenda", evitando assim confusão com registros de outro squad.

O formato do menu agenda pode ser em lista exatamente como o menu "registros".

Observação extra:
- Poderíamos agilizar ainda mais no momento de registrar uma reunião agendada pelo SDR, se através de automação com webhook o grupo no whatsapp fosse criado automaticamente, por exemplo.

SDR entraria no sistema -> clicaria em "agendei reunião" -> colocaria a origem do lead -> nome do lead -> Ao dar o ok, uma automação com webhook criaria o grupo no whatsapp automaticamente

CRIAR GRUPO WHATSAPP AUTOMATICAMENTE

A automação funcionária por webhook, o SDR preencheria os mesmos campos atuais e o sistema enviaria um webhook para o N8N, o N8N faria toda automação.

O N8N não precisa devolver nada, o registro no sistema ficará normal como atualmente, essa automação é só para ganharmos mais alguns segundos na rotina do SDR, para não precisar criar manualmente o grupo de whatsapp.

Com a automação funcionando, o SDR ao clicar em agendei reunião, precisaria preencher "origem do lead" e o campo "grupo wpp" passaria a ser "Nome do Lead".