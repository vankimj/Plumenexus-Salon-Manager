import { describe, it, expect } from 'vitest';
import { sendViaAwsSms } from './awsSms.js';

// Fake AWS client: captures each command's `.input` and returns a MessageId,
// so we can assert exactly what SendTextMessageCommand was built with.
function fakeClient(messageId = 'mid-123') {
  const sent = [];
  return { sent, send: async (cmd) => { sent.push(cmd.input); return { MessageId: messageId }; } };
}

const base = { to: '+16145550123', body: 'hi', originationNumber: '+14139665787' };

describe('sendViaAwsSms — configuration set wiring', () => {
  it('attaches ConfigurationSetName when configurationSet is provided', async () => {
    const client = fakeClient();
    const r = await sendViaAwsSms({ ...base, configurationSet: 'salon-sms', client });
    expect(r).toEqual({ ok: true, messageId: 'mid-123' });
    expect(client.sent[0].ConfigurationSetName).toBe('salon-sms');
  });

  it('omits ConfigurationSetName entirely when not provided (fire-and-forget)', async () => {
    const client = fakeClient();
    await sendViaAwsSms({ ...base, client });
    expect('ConfigurationSetName' in client.sent[0]).toBe(false);
  });

  it('omits ConfigurationSetName when passed empty string', async () => {
    const client = fakeClient();
    await sendViaAwsSms({ ...base, configurationSet: '', client });
    expect('ConfigurationSetName' in client.sent[0]).toBe(false);
  });

  it('maps the core command params (dest/origination/body/type)', async () => {
    const client = fakeClient();
    await sendViaAwsSms({ ...base, messageType: 'PROMOTIONAL', client });
    const input = client.sent[0];
    expect(input.DestinationPhoneNumber).toBe(base.to);
    expect(input.OriginationIdentity).toBe(base.originationNumber);
    expect(input.MessageBody).toBe(base.body);
    expect(input.MessageType).toBe('PROMOTIONAL');
  });

  it('defaults MessageType to TRANSACTIONAL', async () => {
    const client = fakeClient();
    await sendViaAwsSms({ ...base, client });
    expect(client.sent[0].MessageType).toBe('TRANSACTIONAL');
  });

  it('still fails closed on missing to / body / origination', async () => {
    expect((await sendViaAwsSms({ ...base, to: '', client: fakeClient() })).ok).toBe(false);
    expect((await sendViaAwsSms({ to: '+1', body: '', originationNumber: '+1', client: fakeClient() })).ok).toBe(false);
    expect((await sendViaAwsSms({ to: '+1', body: 'x', originationNumber: '', client: fakeClient() })).ok).toBe(false);
  });
});
