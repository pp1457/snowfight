CC = clang++
CFLAGS = -Iinclude -I/usr/local/include -std=c++20
LDFLAGS = -L/usr/local/lib
LIBS = -luSockets -lssl -lz -lcrypto -lpthread

# Final build target
server: src/main.o
	$(CC) $(CFLAGS) src/main.o $(LDFLAGS) $(LIBS) -o server

# Rule to compile source code
src/main.o: src/main.cpp
	$(CC) $(CFLAGS) -c src/main.cpp -o src/main.o

# Clean build files
clean:
	rm -f src/*.o server
