package main

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"io"
	"os"
	"sync"

	"github.com/klauspost/reedsolomon"
)

const (
	ImageFileName = "./data/input/image.JPG"
	OutputFolder  = "./data/chunks/"

	DataShards   = 6
	ParityShards = 3
)

type FileShard struct {
	shard   []byte
	counter int
}

func main() {
	var wg sync.WaitGroup
	var shardChannel = make(chan FileShard)

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

	wg.Add(1)
	go encryptAndUploadChunk(shardChannel, &wg)

	for i, shard := range shards {
		shardChannel <- FileShard{
			shard:   shard,
			counter: i,
		}
	}

	close(shardChannel)

	wg.Wait()

	fmt.Println("Job done!!!")
}

func encryptAndUploadChunk(shardChannel <-chan FileShard, wg *sync.WaitGroup) {
	defer wg.Done()

	for {
		val, ok := <-shardChannel
		if !ok {
			break
		}

		file_path := fmt.Sprintf("%schunk_%d.bin", OutputFolder, val.counter)

		encryptedData, err := encryptData([]byte("test_key123456789123456789123456"), val.shard)
		if err != nil {
			fmt.Println(err)
			panic("Failed to encrypt the shard")
		}

		err = os.WriteFile(file_path, encryptedData, 0644)
		if err != nil {
			panic("Failed to write the shard")
		}

		fmt.Printf("Saved the chunk %d\n", val.counter)
	}
}

func encryptData(key []byte, plaintext []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}

	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, err
	}

	// Prepend nonce to ciphertext
	return aead.Seal(nonce, nonce, plaintext, nil), nil
}
