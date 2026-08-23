#!/bin/bash

# Get the commit message from the file passed as an argument
COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Define the regex: type(scope): #NUMBER: message
# Types: feat, chore, ci, bug
# Scope: lowercase letters and hyphens
# Issue: # followed by digits (GitHub issue number), issue number is same as branch.
# Message: at least one character
REGEX="^(feat|chore|ci|bug)\([a-z-]+\): #[0-9]+: .+"

# Skip validation for merge commits
if [[ $COMMIT_MSG =~ ^Merge[[:space:]] ]]; then
    echo "Merge commit detected. Skipping validation."
    exit 0
fi

if [[ ! $COMMIT_MSG =~ $REGEX ]]; then
    echo "Error: Commit message does not follow the convention!"
    echo "Expected format: type(scope): #<NUMBER>: message"
    echo "Allowed types: feat, chore, ci, bug"
    echo "Example: feat(ui): #123: add login button"
    exit 1
fi

echo "Commit message follows the convention."
exit 0
