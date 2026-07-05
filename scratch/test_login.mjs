async function testLogin() {
  const res = await fetch('http://127.0.0.1/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@riopizzas.com', password: 'admin123' })
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Data:', data);
}

testLogin();
