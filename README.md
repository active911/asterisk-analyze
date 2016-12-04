# Asterisk-analyze


#### Prereqs 
Make sure you have these modules...
```perl
DateTime::Format::Strptime
JSON
Config::Simple
FindBin
```

#### Usage
```bash
cp config.cfg.sample config.cfg
vi config.cfg
```

Now run the program
```bash
cat /var/log/asterisk/full | ./analyze.pl -p
```

You will get a nice JSON blob listing stats.

Omit the ```-p``` switch to have the JSON written to ```$outfile```.


