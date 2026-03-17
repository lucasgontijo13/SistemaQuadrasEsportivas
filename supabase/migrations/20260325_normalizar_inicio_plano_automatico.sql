update public.matriculas
set data_inicio = null
where status in ('aguardando_dados', 'aguardando_pagamento', 'aguardando_aceite_professor');
