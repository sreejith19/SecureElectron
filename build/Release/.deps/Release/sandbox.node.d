cmd_Release/sandbox.node := ln -f "Release/obj.target/sandbox.node" "Release/sandbox.node" 2>/dev/null || (rm -rf "Release/sandbox.node" && cp -af "Release/obj.target/sandbox.node" "Release/sandbox.node")
