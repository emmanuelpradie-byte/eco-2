#!/bin/bash
# Postgres de test + serveurs http (appli et faux Supabase)
if [ ! -d /tmp/pgtest/data ]; then mkdir -p /tmp/pgtest && chown postgres /tmp/pgtest && su postgres -c "/usr/lib/postgresql/16/bin/initdb -D /tmp/pgtest/data -A trust -U postgres >/tmp/pgtest/init.log 2>&1"; fi
su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/pgtest/data -o '-p 54329 -k /tmp/pgtest' -l /tmp/pgtest/log start" >/dev/null 2>&1
sleep 1.5
curl -s -o /dev/null localhost:8800/index.html || (cd /mnt/user-data/outputs/economat-pro && nohup python3 -m http.server 8800 >/dev/null 2>&1 &)
curl -s -o /dev/null localhost:8765/ || (cd /mnt/user-data/outputs && nohup python3 -m http.server 8765 >/dev/null 2>&1 &)
sleep 0.5
