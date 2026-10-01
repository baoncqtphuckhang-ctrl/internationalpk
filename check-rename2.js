
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://bmffexturrzgdvmeofsg.supabase.co', 'sb_publishable_MVhOPjmDJH1hhKOJufcwLQ_9gOODJu3'); 
async function run() {
  const { data: projects } = await supabase.from('projects').select('*').ilike('name', '%test%');
  console.log('Projects:', projects);
}
run();

