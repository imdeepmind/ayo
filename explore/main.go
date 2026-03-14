package main

import (
	"fmt"
	"io"
	"os"

	"github.com/klauspost/reedsolomon"
)

const (
	ImageFileName = "./data/input/image.JPG"
	OutputFolder  = "./data/chunks/"

	DataShards   = 6
	ParityShards = 3
)

func main() {
	// reading the file
	file, err := os.Open(ImageFileName)
	if err != nil {
		panic("Failed to open the file")
	}

	defer file.Close()

	// getting the file info
	fileInfo, err := file.Stat()
	if err != nil {
		panic("Failed to fetch the file stats")
	}

	// create encoder
	enc, err := reedsolomon.New(DataShards, ParityShards)
	if err != nil {
		panic("Failed to create the encoder")
	}

	// shard size
	shardSize := int(fileInfo.Size()+DataShards-1) / DataShards
	buffer := make([]byte, shardSize*int(DataShards))

	_, err = io.ReadFull(file, buffer)
	if err != nil && err != io.ErrUnexpectedEOF {
		panic("Failed to read the file")
	}

	// allocate the shards
	shards := make([][]byte, DataShards+ParityShards)

	for i := 0; i < DataShards; i++ {
		start := i * shardSize
		end := start + shardSize
		shards[i] = buffer[start:end]
	}

	// allocate the parity shards
	for i := DataShards; i < DataShards+ParityShards; i++ {
		shards[i] = make([]byte, shardSize)
	}

	// encode
	err = enc.Encode(shards)
	if err != nil {
		panic(fmt.Sprintf("Failed to encode the file: %v", err))
	}

	for i, shard := range shards {
		shard_path := fmt.Sprintf("%sshard_%d.bin", OutputFolder, i)

		err := os.WriteFile(shard_path, shard, 0644)
		if err != nil {
			panic("Failed to write the shard")
		}
	}

	fmt.Println("Job done!!!")
}
