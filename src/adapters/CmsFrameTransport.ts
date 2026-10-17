/** A nested learning pane uses its explicitly transferred MessagePort. */
export function sendCmsFrameMessage(data: unknown): void {
    const transport = (window as any).__gcsFrameTransport;
    if (transport) transport.send(data);
    else window.parent.postMessage(data, new URL(document.baseURI).origin);
}

export function onCmsFrameMessage(listener: (data: any) => void): () => void {
    const transport = (window as any).__gcsFrameTransport;
    if (transport) return transport.subscribe(listener);
    const handler = (event: MessageEvent) => {
        if (event.source === window.parent && event.origin === new URL(document.baseURI).origin) listener(event.data);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
}
