const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
  const { data, error } = await supabase
    .from('business_info')
    .select('manufacturer')
    .not('manufacturer', 'is', null);

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Count by manufacturer
  const counts = data.reduce((acc, item) => {
    acc[item.manufacturer] = (acc[item.manufacturer] || 0) + 1;
    return acc;
  }, {});

  console.log('제조사별 레코드 개수:');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([name, count]) => {
    console.log(`  ${name}: ${count}개`);
  });
})();
