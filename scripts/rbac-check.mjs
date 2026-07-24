const base = 'http://localhost:3000';

function createSession() {
  let cookie = '';

  return {
    async request(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      if (cookie) headers.cookie = cookie;

      const response = await fetch(`${base}${path}`, {
        ...options,
        headers,
      });

      const setCookie = response.headers.get('set-cookie');
      if (setCookie) {
        cookie = setCookie.split(';')[0];
      }

      const raw = await response.text();
      let data = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = raw;
      }

      return { status: response.status, data };
    },
  };
}

async function main() {
  const admin = createSession();
  const agent = createSession();

  await admin.request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@brokerhub.local', password: 'admin1234' }),
  });

  const adminBootstrap = await admin.request('/api/real-estate/bootstrap', { method: 'POST' });
  const oppRes = await admin.request('/api/real-estate/opportunities?limit=1');
  const agentsRes = await admin.request('/api/real-estate/agents?onlyActive=true');

  const opp = oppRes?.data?.opportunities?.[0];
  const agents = agentsRes?.data?.agents || [];

  if (!opp || agents.length < 2) {
    console.error('RBAC_CHECK_INCOMPLETE', {
      oppFound: Boolean(opp),
      agentsFound: agents.length,
    });
    process.exit(2);
  }

  await agent.request('/api/auth/agent-login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ phone: agents[0].phone }),
  });

  const agentBootstrap = await agent.request('/api/real-estate/bootstrap', { method: 'POST' });
  const denyOtherClaim = await agent.request(`/api/real-estate/opportunities/${opp.id}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agentId: agents[1].id }),
  });
  const allowOwnClaim = await agent.request(`/api/real-estate/opportunities/${opp.id}/claim`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agentId: agents[0].id }),
  });

  console.log(
    JSON.stringify(
      {
        admin_bootstrap: adminBootstrap.status,
        agent_bootstrap: agentBootstrap.status,
        deny_other_claim: denyOtherClaim.status,
        allow_own_claim: allowOwnClaim.status,
        opp_id: opp.id,
        agent0_id: agents[0].id,
        agent1_id: agents[1].id,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error('RBAC_CHECK_ERROR', error);
  process.exit(1);
});
