# Call

P2P videocalls via WebRTC for integration into Delta Chat clients.

## Integrating

To integrate into your Delta Chat client you need to provide a
`window.calls` object with the following API:

- `startCall: (payload: string) => void`
- `acceptCall: (payload: string) => void`
- `endCall: () => void`
- `getIceServers: () => string` (returns a JSON string with array of ice server configurations as expected by https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/setConfiguration)
- `getAvatar: () => string` (returning the chat's avatar image data-URL encoded)

Commands and events are given to the app via URL hash:

- `#call`: makes the app start a call offer
- `#offer=PAYLOAD`: pass to the app a call offer payload
- `#answer=PAYLOAD`: pass to the app a call answer payload

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
