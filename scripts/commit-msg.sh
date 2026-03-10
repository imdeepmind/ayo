#!/bin/bash

# Get the commit message from the file passed as an argument
COMMIT_MSG_FILE=$1
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

# Define the regex: type(scope): AYO-NUMBER: message
# Types: feat, chore, ci, bug
# Scope: lowercase letters and hyphens
# JIRA: AYO- followed by digits
# Message: at least one character
REGEX="^(feat|chore|ci|bug)\([a-z-]+\): AYO-[0-9]+: .+"

if [[ ! $COMMIT_MSG =~ $REGEX ]]; then
    echo "Error: Commit message does not follow the convention!"
    echo "Expected format: type(scope): AYO-<NUMBER>: message"
    echo "Allowed types: feat, chore, ci, bug"
    echo "Example: feat(ui): AYO-123: add login button"
    exit 1
fi

echo "Commit message follows the convention."
exit 0
