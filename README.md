# Call

P2P videocalls via WebRTC for integration into Delta Chat clients.

## Integrating

To integrate into your Delta Chat client you need to provide a
`window.calls` object with the following API:

- `startCall: (offerPayload: string) => void` (implementation must call `dc_place_outgoing_call` chatmail core API)
- `acceptCall: (answerPayload: string) => void` (implementation must call `dc_accept_incoming_call` chatmail core API)
- `endCall: () => void` (implementation must call `dc_end_call` chatmail core API)
- `getIceServers: () => string | Promise<string>` (returns a JSON string with array of ice server configurations as expected by https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setConfiguration)
- `getAvatar: () => string` (returning the chat's avatar image URL; can be a regular URL or a data-URL, ex. `"data:image/png;base64,..."`)

Commands are given to the app via URL hash:

- `#startCall`: tells the app to generate an offer payload and call `startCall()`, this is how the app should be open when the user is starting an outgoing call.
- `#offerIncomingCall=PAYLOAD`: tells the app to show the "Incoming call. Answer?" screen. Then, if the user clicks "Answer", generate a WebRTC answer to the offer provided in `PAYLOAD`, and call `window.calls.acceptCall(webrtcAnswer)`. If the user declined the call, the app will invoke `window.calls.endCall`.
- `#acceptCall=PAYLOAD`: same as `#offerIncomingCall`, but doesn't show the "Incoming call. Answer?" screen and instead automatically and immediately accepts the call.
- `#onAnswer=PAYLOAD`: notifies the app that the outgoing call was accepted and provides the answer payload

**IMPORTANT:** `PAYLOAD` **must** be base64 encoded (NOTE: you might still need to URL-encode the base64 string to be a valid URL hash) before passing it to the app in the URL hash.

In order to start the app in audio-only mode initially,
provide `noOutgoingVideoInitially` in the query (search) string
of the initial URL, e.g. `/index.html?noOutgoingVideoInitially#startCall`.

In order to completely disable incoming and outgoing video,
provide `disableVideoCompletely` in the query string of the URL.
See <https://github.com/deltachat/calls-webapp/issues/31>.

## Contributing

### Installing Dependencies

After cloning this repo, install dependencies:

```
pnpm i
```

### Checking code format

```
pnpm check
```

### Testing the app in the browser

To test your work in your browser while developing:

```
pnpm start
```

Open the simulated instances in 2 separate tabs (the "share" button on the instance in the simulator).
Then add `#startCall` to the end of the URL of one instance.

On macOS on Safari, you may not be able to give access to the camera to two tabs simultaneously; in this case, try Firefox.

### Building

To build the app for releasing:

```
pnpm build
```

To package the app with developer tools inside to debug in Delta Chat, set the `NODE_ENV`
environment variable to "debug":

```
NODE_ENV=debug pnpm build
```

The resulting optimized `.html` file is saved in `dist/` folder.

### Releasing

To automatically build and create a new GitHub release with the `.html` file:

```
git tag -a v1.0.1
git push origin v1.0.1
```

### Credits

Inspired by [Serverless WebRTC][serverless-webrtc] but built from scratch and much simpler:
no data channel, file transfer and only browsers are supported.

See blog posts explaining the idea here:

- [WebRTC without a signaling server](https://blog.printf.net/articles/2013/05/17/webrtc-without-a-signaling-server/)
- [Serverless WebRTC, continued](https://blog.printf.net/articles/2014/07/01/serverless-webrtc-continued/)

[serverless-webrtc]: https://github.com/cjb/serverless-webrtc/
