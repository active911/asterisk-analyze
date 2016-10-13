#!/usr/bin/perl

use DateTime::Format::Strptime;
use Data::Dumper;
use JSON qw(encode_json);
use strict;
use warnings;


# Parameters
my $timezone='America/Los_Angeles';
my $outfile='/var/www/html/stats.json';


my $calls={};
my $parser=DateTime::Format::Strptime-> new( pattern => '%Y-%m-%d %H:%M:%S', time_zone => $timezone);

while(my $line=<STDIN>) {

	if($line=~/\[(\d\d\d\d-\d\d\-\d\d \d\d:\d\d:\d\d)\].*(SIP\/fpbx\-[a-z0-9\-]+)/) {

		# Get the ID and UTC time stamp
		my $dt=$parser->parse_datetime($1);
		my $stamp=$dt->epoch;
		my $id=$2;

		# Create a new entry
		if(!defined($calls->{$id})){
			$calls->{$id}={

				started		=>		$stamp,
				hangup		=>		undef,
				queued_duration	=>	undef,
				queued		=>		undef,
				answered	=>		undef,
				answered_by =>		undef,
				caller_id	=>		"",
				duration	=>		0,
				pickup_duration =>  undef
			};

			next;
		}

		# The call has already started, so parse additional lines for addtional facts.  
		if($line=~/Local\/(\d+).*answered SIP/) {

			# Answered (1st time only)
			if(!defined($calls->{$id}->{answered_by})) {

				$calls->{$id}->{answered_by}=$1;
				$calls->{$id}->{answered}=$stamp;
				$calls->{$id}->{queued_duration}=int $stamp-$calls->{$id}->{queued} unless !defined ($stamp-$calls->{$id}->{queued});
			}

		} elsif ($line=~/hangup/i) {		# hangupcall seems to mean that they hung up. If we hang up, it looks like 'Executing [h@ivr-3:1] Hangup("SIP/fpbx-1-f04d84a7-0028664a", "") in new stack'

			# Hang up
			$calls->{$id}->{hangup}=$stamp;
			$calls->{$id}->{duration}=int $stamp-$calls->{$id}->{started};
			$calls->{$id}->{pickup_duration}=$stamp-$calls->{$id}->{answered} unless !defined ($calls->{$id}->{answered});


		} elsif ($line=~/CALLERID\(name\)\=(\d+)/) {

			# Caller ID
			$calls->{$id}->{caller_id}=$1;


		} elsif ($line=~/Goto\("$id", "ext-queues,299,1"\)/) {

			# Goes to queue (1st time only)
			if(!defined($calls->{$id}->{queued})) {

				$calls->{$id}->{queued}=$stamp;
			}

		}

		
	}


}


# OK, time to analyze the calls! 
my $stats={

	queue	=>	{

		total_calls		=>	0,
		total_time		=>	0,
		average_time	=>	0,
		hangups			=>	0,
		histogram		=>	{

			'10'	=>	0,
			'20'	=>	0,
			'30'	=>	0,
			'40'	=>	0,
			'50'	=>	0,
			'60'	=>	0,
			'90'	=>	0,
			'120'	=>	0,
			'180'	=>	0,
			'240'	=>	0,
			'300'	=>	0,
			'more'	=>	0

		},
	},
	extensions => {


	}
};

# Generate statistics
CALL_QUEUE_TIME: foreach my $id(keys %{$calls}) {

	my $call=$calls->{$id};

	# Extension stats (calls answered, time on phone)
	if(defined($call->{answered}) && defined($call->{answered_by})) {

		# Make sure we have a record for this extension
		if(!defined($stats->{extensions}->{$call->{answered_by}})){

			$stats->{extensions}->{$call->{answered_by}}={

				calls	=>	0,
				total_time	=>	0
			};
		} 

		# Update stats for this extensions
		$stats->{extensions}->{$call->{answered_by}}->{total_time}+=$call->{pickup_duration} unless !defined($call->{pickup_duration});  # Maybe they are still on the phone, so we don't have a final duration yet
		$stats->{extensions}->{$call->{answered_by}}->{calls}++;

	}

	# Queue (hold) stats
	if(defined($call->{queued_duration})) {

		# Was this a hangup (no one got it before the end of the call)?
		if(!defined ($call->{answered})){

			$stats->{queue}->{hangups}++;
		}

		# Increment totals
		$stats->{queue}->{total_calls}++;
		$stats->{queue}->{total_time}+=$call->{queued_duration};

		# Put call in bucket
		foreach my $bucket (keys %{$stats->{queue}->{histogram}}) {

			next if $bucket eq "more";

			if($call->{queued_duration} <= int $bucket) {

				$stats->{queue}->{histogram}->{$bucket}++;
				next CALL_QUEUE_TIME;
			}
		}

		# If we are here, the queue time is longer than the highest bucket
		$stats->{queue}->{histogram}->{more}++;
	}
}

# Calculate average queue time
$stats->{queue}->{average_time}=$stats->{queue}->{total_time}/$stats->{queue}->{total_calls};


open (my $F, '>', $outfile) or die("Unable to write to $outfile\n");
print $F encode_json($stats);
close $F;



































