import { testTcpTransport } from "../../../tests/helpers/tcp-transport-contract.js";
import { NodeTcpGdbRspTransport } from "../src/node-tcp-gdb-rsp-transport.js";

testTcpTransport((options) => NodeTcpGdbRspTransport.connect(options));
