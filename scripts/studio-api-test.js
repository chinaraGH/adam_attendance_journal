async function main() {
  const ws = new WebSocket("ws://127.0.0.1:5557/api");
  ws.addEventListener("open", () => {
    ws.send(
      JSON.stringify({
        requestId: 1,
        channel: "prisma",
        action: "getDMMF",
        payload: { data: null },
      }),
    );
  });
  ws.addEventListener("message", (evt) => {
    console.log("message:", String(evt.data).slice(0, 500));
    ws.close();
  });
  ws.addEventListener("error", (evt) => {
    console.error("ws error:", evt);
    process.exitCode = 1;
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

