import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

// Every page reads the live directory per request, so there is no
// incremental cache to configure.
export default defineCloudflareConfig({});
