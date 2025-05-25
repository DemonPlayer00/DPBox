#!/bin/bash

read -p "Enter phone: " phone
if [[ -z $phone ]]; then
    echo "Phone number cannot be empty"
    exit 1
fi
read -p "Enter name: " name
if [[ -z $name ]]; then
    echo "Name cannot be empty"
    exit 1
fi
read -p "Enter permission ( default: guest ): " permission
if [[ -z $permission ]]; then
    permission="guest"
fi
read -p "Enter resid ( default: <empty>): " resid

echo "Registering..."

redis-cli hSet UserInfo::$phone phone $phone  name $name permission $permission resid $resid
