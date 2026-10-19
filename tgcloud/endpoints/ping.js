// TEMPORARY: proves the Mini App can reach the server and that init data is verified.
export default async function (input, ctx) {
  const u = ctx.initData.user;
  return {
    user: { id: u.id, first_name: u.first_name },
    startParam: ctx.initData.start_param ?? null,
    chatType: ctx.initData.chat_type ?? null,
    echo: input.tap ?? null,
    serverTime: Date.now(),
  };
}