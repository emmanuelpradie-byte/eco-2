#!/bin/bash
cd "$(dirname "$0")"
P="psql -h /tmp/pgtest -p 54329 -U postgres -q"
$P -c "drop database if exists eco" -c "create database eco" >/dev/null && $P -d eco -f stub.sql >/dev/null && $P -d eco -f supabase-setup.sql 2>&1 | grep -v NOTICE
[ -f mock.pid ] && kill $(cat mock.pid) 2>/dev/null; sleep 0.3
nohup python3 mock_supabase.py 8787 "$@" > mock.log 2>&1 &
echo $! > mock.pid
sleep 1
