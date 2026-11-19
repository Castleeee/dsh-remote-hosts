const response = await fetch(`${process.env.DSH_SSH_GATEWAY}/manage/ssh/askpass`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.DSH_SSH_CHALLENGE}` },
  body: JSON.stringify({ prompt: process.argv[2], hint: process.env.SSH_ASKPASS_PROMPT }),
  signal: AbortSignal.timeout(180000),
})
if (!response.ok) process.exit(1)
process.stdout.write(await response.text())
