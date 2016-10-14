# Asterisk-analyze


#### Prereqs 
Make sure you have these modules...
```perl
DateTime::Format::Strptime
JSON
```

#### Usage
Modify the following lines to conform to your settings
```perl
my $timezone='America/Los_Angeles';
my $outfile='/var/www/html/stats.json';
my $queue='299';
```

Now run the program
```bash
cat /var/log/asterisk/full | ./analyze.pl -p
```

You will get a nice JSON blob listing stats.

Omit the ```-p``` switch to have the JSON written to ```$outfile```.


