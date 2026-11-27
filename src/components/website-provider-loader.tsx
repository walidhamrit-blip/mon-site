"use client";

import dynamic from "next/dynamic";

// The split point must be inside a client module. A server-only dynamic()
// still eagerly includes its client graph in the shared layout entry.
// SSR remains enabled for the website; /tg does not render this boundary.
export default dynamic(() => import("./website-providers"));
