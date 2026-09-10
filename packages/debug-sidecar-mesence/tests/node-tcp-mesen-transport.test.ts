import { testTcpTransport } from "../../../tests/helpers/tcp-transport-contract.js";
import { NodeTcpMesenTransport } from "../src/node-tcp-mesen-transport.js";

testTcpTransport((options) => NodeTcpMesenTransport.connect(options));
