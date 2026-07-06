import pg from 'pg';

const { Client } = pg;

const connectionString = 'postgresql://postgres:password@127.0.0.1:5433/pizzaria?schema=public';

async function checkAdmin() {
  const c = new Client({ connectionString });
  try {
    await c.connect();
    console.log('✅ Conectado ao banco de dados!');

    // Verificar estado atual
    const result = await c.query(
      'SELECT id, email, role, "tenantId" FROM "Admin" WHERE email = $1',
      ['admin@riopizzas.com']
    );
    
    if (result.rows.length === 0) {
      console.log('⚠️  Nenhuma conta admin@riopizzas.com encontrada no banco.');
    } else {
      console.log(`\n📋 Contas encontradas: ${result.rows.length}`);
      result.rows.forEach((r, i) => {
        const ok = r.role === 'OWNER' ? '✅' : '❌';
        console.log(`  ${i+1}. ${ok} email: ${r.email}`);
        console.log(`     role: ${r.role}`);
        console.log(`     id: ${r.id}`);
        console.log(`     tenantId: ${r.tenantId}`);
        console.log();
      });

      // Corrigir role se necessário
      const toFix = result.rows.filter(r => r.role !== 'OWNER');
      if (toFix.length > 0) {
        console.log(`🔧 Corrigindo ${toFix.length} conta(s) para role OWNER...`);
        const upd = await c.query(
          "UPDATE \"Admin\" SET role = 'OWNER' WHERE email = $1 AND role != 'OWNER' RETURNING id, email, role",
          ['admin@riopizzas.com']
        );
        console.log(`✅ ${upd.rowCount} conta(s) atualizadas:`);
        upd.rows.forEach(r => {
          console.log(`   ✅ ${r.email} → role: ${r.role}`);
        });
      } else {
        console.log('✅ Todas as contas já têm role OWNER. Nenhuma correção necessária.');
      }
    }
  } catch (err) {
    console.error('❌ Erro de conexão:', err.message);
    console.error('   Verifique se o Docker/PostgreSQL está rodando na porta 5433.');
  } finally {
    await c.end();
  }
}

checkAdmin();
