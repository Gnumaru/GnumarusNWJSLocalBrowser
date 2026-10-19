
- estamos em um ambiente grafico linux ubuntu 26.04 com wayland e gnome, em um terminal bash sem permissoes de root.
- se precisar que eu faça qualquer operação como root, como instalar algo com apt, me peça que eu instalo.
- se tiver qualquer tipo de duvida pergunte antes de prosseguir.
- converse comigo apenas em portugues brasileiro. faça todo o resto em ingles americano.
- nunca utilize o diretorio /tmp. ao inves disso, se precisar criar coisas temporarias, utilize o diretorio local ./tmp
- nunca utilize sub agentes. faça tudo na sessão principal.
- sempre planeje tudo em um arquivo PLAN.md e crie uma lista de tarefas em CHECKLIST.md. mantenha ambos sempre atualizados a medida que for trabalhando.
- mantenha sempre atualizados os arquivos FEATURES_SUMMARY.md que tera a lista resumida de todas as funcionalidades implementadas e FEATURES_DETAIL.md que terá a explicação detalhada de todas as funcionalidades implementadas.
- utilize qualquer meio ou tecnologia necessaria como forma de teste ou de etapa intermediaria para alcancar os objetivos finais.
- nunca utilize comandos do git que possam alterar o estado dos arquivos em disco ou da staging area, como stash, checkout, commit e push. utilize apenas operacoes de leitura como log e status.

- estamos criando um app para windows, linux e mac utilizando nw.js que sera ao mesmo tempo um servidor web apenas local e um browser para as paginas existentes no diretorio do servidor.
- o usuário informará o diretório por linha de comando. caso nao informe, ao iniciar o app exibirá uma janela de dialogo para que o usuário escolha o diretorio.
- uma vez escolhido o diretorio, o app irá iniciar um servidor web apenas local na porta 1024 servindo o conteúdo daquele diretorio. o app irá exibir uma listagem dos arquivos e diretorios permitindo navegar pela listagem. ao clicar em qualquer arquivo html ele será carregado e exibido como se o chromium tivesse acessado a pagina. é importante que a api do nodejs esteja disponível na página carregada. É importante que o servidor web bloqueie qualquer requisicao inbound (de fora do endereço de loopback)
