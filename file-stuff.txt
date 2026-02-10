package main

import (
	"fmt"
	"os"
	"io"
	"path/filepath"
)

func OpenFileDescriptor(path string) *os.File {
	file, err := os.Open(path)

	if err != nil {
		panic(fmt.Sprintf("Failed to open file descriptor: %v", err))
	}

	return file
}

func WriteChunk(index int64, chunk []byte) {
	filename := filepath.Join("./data/chunks", fmt.Sprintf("%d", index))

	out, err := os.Create(filename)

	if err != nil {
		panic(fmt.Sprintf("Failed to create file: %v", err))
	}

	defer out.Close()

	_, err = out.Write(chunk)

	if err != nil {
		panic(fmt.Sprintf("Failed to write chunk: %v", err))
	}
}

func ReconstructFromChunks() {
	chunksDir := "./data/chunks"
	newFile := "./data/output/image.JPG"

	out, err := os.Create(newFile)

	if err != nil {
		panic(fmt.Sprintf("Failed to create file: %v", err))
	}

	defer out.Close()

	var index int64 = 0

	for {
		filename := filepath.Join(chunksDir, fmt.Sprintf("%d", index))
		
        in, err := os.Open(filename)	
		
		if err != nil {
			if os.IsNotExist(err) {
				break
			}
			panic(fmt.Sprintf("Failed to open file: %v", err))
		}
		
		defer in.Close()
		
        _, err = io.Copy(out, in)

		if err != nil {
			panic(fmt.Sprintf("Failed to copy chunk: %v", err))
		}
		
		index++		
	}
}

func main() {
	file := OpenFileDescriptor("./data/input/image.JPG")
	defer file.Close()

	const chunkSize = 4 * 1024

	buffer := make([]byte, chunkSize)
	var index int64 = 0

	for {
		n, err := file.Read(buffer)

		if err != nil {
			if err == io.EOF {
				break
			}
			panic(fmt.Sprintf("Failed to read file: %v", err))
		}

		chunk := buffer[:n]

		fmt.Println("Chunk: ", len(chunk))
		WriteChunk(index, chunk)
		index++
	}

	ReconstructFromChunks()
}
