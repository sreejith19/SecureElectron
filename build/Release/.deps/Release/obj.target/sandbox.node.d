cmd_Release/obj.target/sandbox.node := g++ -shared -pthread -rdynamic -m64  -Wl,-soname=sandbox.node -o Release/obj.target/sandbox.node -Wl,--start-group Release/obj.target/sandbox/src/addon.o Release/obj.target/sandbox/src/baton.o Release/obj.target/sandbox/src/sandbox.o -Wl,--end-group 