#!/usr/bin/perl

use DateTime::Format::Strptime;
use Data::Dumper;
use JSON qw(encode_json);
use Config::Simple;
use FindBin;
use strict;
use warnings;

# Read config
my $cfg=new Config::Simple($FindBin::Bin.'/config.cfg');
if(!defined $cfg) {

	die("Error reading configuration file.  Please copy config.cfg.sample to config.cfg and edit any default options.");
}

my $timezone=	$cfg->param('general.timezone');								
my $queues=		$cfg->param('asterisk.queues');

# Parameters
my $outfile='stats.json';

my $calls={};
my $parser=DateTime::Format::Strptime-> new( pattern => '%Y-%m-%d %H:%M:%S', time_zone => $timezone);

while(my $line=<STDIN>) {

	if($line=~/\[(\d\d\d\d-\d\d\-\d\d \d\d:\d\d:\d\d)\].*(SIP\/fpbx\-[a-z0-9\-]+)/i) {

		# Get the ID and UTC time stamp
		my $dt=$parser->parse_datetime($1);
		my $stamp=$dt->epoch;
		my $id=$2;

		# Create a new entry if it doesn't exist
		if(!defined($calls->{$id})){

			$calls->{$id}={

				started		=>		$stamp,
				hangup		=>		undef,
				queued_duration	=>	undef,
				queued		=>		undef,
				answered	=>		undef,
				answered_by =>		undef,
				answered_ct =>		0,
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
				$calls->{$id}->{queued_duration}=$stamp-$calls->{$id}->{queued} unless !defined ($calls->{$id}->{queued});

			}

			# Increment answered count (to detect errors, or transfers)
			$calls->{$id}->{answered_ct}++;


		} elsif ($line=~/hangup/i) {		# hangupcall seems to mean that they hung up. If we hang up, it looks like 'Executing [h@ivr-3:1] Hangup("SIP/fpbx-1-f04d84a7-0028664a", "") in new stack'

			# Hang up
			$calls->{$id}->{hangup}=$stamp;
			$calls->{$id}->{duration}=int $stamp-$calls->{$id}->{started};
			$calls->{$id}->{pickup_duration}=$stamp-$calls->{$id}->{answered} unless !defined ($calls->{$id}->{answered});

			if(defined ($calls->{$id}->{answered})){

				# If the call was answered, we have a pickup duration
				$calls->{$id}->{pickup_duration}=$stamp-$calls->{$id}->{answered};

			} else {

				# If not, and if it was queued, the queued duration ends now
				$calls->{$id}->{queued_duration}=$stamp-$calls->{$id}->{queued} unless !defined ($calls->{$id}->{queued});
			}


		} elsif ($line=~/CALLERID\(name\)\=(\d+)/) {

			# Caller ID
			$calls->{$id}->{caller_id}=$1;

# [2016-12-03 15:30:34] VERBOSE[9588][C-00016819] pbx.c:     -- Executing [in@sub-record-check:3] ExecIf("SIP/fpbx-1-4VVl0cGHFeH1-0000c72e", "11?Set(FROMEXTEN=15412300243)") in new stack
# 0cGHFeH1-0000c72e", "0 ?Set(CALLERID(name)=15412300243)") in new stack

		} elsif ($line=~/Goto\("$id", "ext-queues,'$queues',1"\)/) {

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
		total_answers	=>	0,
		total_time		=>	0,
		average_time	=>	0,
		hangups			=>	{

			total			=>	0,
			total_time		=>	0,
			average_time	=>	0

			},
		histogram		=>	[

			{ value => 10, count	=>	0 },
			{ value => 20, count	=>	0 },
			{ value => 30, count	=>	0 },
			{ value => 40, count	=>	0 },
			{ value => 50, count	=>	0 },
			{ value => 60, count	=>	0 },
			{ value => 90, count	=>	0 },
			{ value => 120, count	=>	0 },
			{ value => 180, count	=>	0 },
			{ value => 240, count	=>	0 },
			{ value => 300, count	=>	0 },
			{ value => 'more', count	=>	0 }
		],
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
	if(defined($call->{queued})) {

		# Increment totals (queued_duration check is in case it has no queued duration, i.e. is still waiting pickup but hasn't yet been answered or hung up)
		if($call->{queued_duration}) {

			$stats->{queue}->{total_calls}++;
			$stats->{queue}->{total_answers}+=$call->{answered_ct};
			$stats->{queue}->{total_time}+=$call->{queued_duration};


			# Was this a hangup (no one got it before the end of the call)?
			if(!defined ($call->{answered}) && defined ($call->{hangup})){

				$stats->{queue}->{hangups}->{total}++;
				$stats->{queue}->{hangups}->{total_time}+=$call->{queued_duration};
			}

			# Put call in bucket 
			my $more_bucket;
			foreach my $bucket (@{$stats->{queue}->{histogram}}) {

				if($bucket->{value} eq "more"){
					$more_bucket=$bucket;
					next;
				}

				if($call->{queued_duration} <= $bucket->{value}) {

					$bucket->{count}++;
					next CALL_QUEUE_TIME;
				}
			}

			# If we are here, the queue time is longer than the highest bucket
			$more_bucket->{count}++;
		}

	}
}

# Calculate average queue time
$stats->{queue}->{average_time}=$stats->{queue}->{total_time}/$stats->{queue}->{total_calls} unless $stats->{queue}->{total_calls}==0;
$stats->{queue}->{hangups}->{average_time}=$stats->{queue}->{hangups}->{total_time}/$stats->{queue}->{hangups}->{total} unless $stats->{queue}->{hangups}->{total}==0;


if ($ARGV[0] eq '-p') {

	print encode_json($stats)."\n";

} elsif ($ARGV[0] eq '-pc') {

	print encode_json($calls)."\n";

} else {

	open (my $F, '>', $outfile) or die("Unable to write to $outfile\n");
	print $F encode_json($stats);
	close $F;

}



































