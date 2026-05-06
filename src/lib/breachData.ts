export type BreachCategory = 'espionage' | 'ransomware' | 'datatheft' | 'sabotage' | 'hacktivism';
export type BreachSeverity = 'catastrophic' | 'critical' | 'major';

export type BreachEvent = {
  id: string;
  year: number;
  month: number;
  title: string;
  target: string;
  category: BreachCategory;
  severity: BreachSeverity;
  records?: number;
  attackVector: string;
  description: string;
  impact: string;
  nation?: string;
};

export const breachData: BreachEvent[] = [
  {
    id: 'sql-slammer-2003',
    year: 2003,
    month: 1,
    title: 'SQL Slammer Worm',
    target: 'Global Internet Infrastructure',
    category: 'sabotage',
    severity: 'critical',
    attackVector: 'UDP Exploit / Buffer Overflow',
    description:
      'SQL Slammer (a.k.a. Sapphire) was a self-propagating computer worm that exploited a buffer overflow vulnerability in Microsoft SQL Server 2000. Remarkably small at just 376 bytes, it doubled in size every 8.5 seconds and infected 75,000 hosts within 10 minutes of release — the fastest spreading worm in history at the time.',
    impact:
      'Caused significant internet slowdowns worldwide, knocked South Korean internet offline, disrupted Bank of America ATMs, crashed Continental Airlines ticketing systems, and caused US 911 call center failures. Estimated damage exceeded $1 billion globally.',
  },
  {
    id: 'estonia-2007',
    year: 2007,
    month: 4,
    title: 'Estonia Cyberattacks',
    target: 'Estonian Government & Infrastructure',
    category: 'hacktivism',
    severity: 'critical',
    attackVector: 'DDoS Botnet',
    description:
      "A series of cyberattacks targeting Estonia's parliament, banks, ministries, broadcasters, and newspapers following disputes over the relocation of the Bronze Soldier of Tallinn Soviet war memorial. The attacks lasted three weeks and were among the first nationally-coordinated cyberattacks in history.",
    impact:
      'Online banking services disrupted for days, government communications severely hampered, news websites taken offline. NATO established the Cooperative Cyber Defence Centre of Excellence (CCDCOE) in Tallinn directly in response. Considered the first cyberwar against a nation-state.',
    nation: 'Russia',
  },
  {
    id: 'buckshot-yankee-2008',
    year: 2008,
    month: 10,
    title: 'Operation Buckshot Yankee',
    target: 'US Department of Defense',
    category: 'espionage',
    severity: 'catastrophic',
    attackVector: 'Infected USB Drive',
    description:
      'A foreign intelligence agency distributed USB flash drives infected with the agent.btz worm in parking lots near US military facilities in the Middle East. When plugged into classified and unclassified networks at CENTCOM, the malware created a beachhead for exfiltration of sensitive military data — the largest breach of US military computers ever at the time.',
    impact:
      'Led to the creation of US Cyber Command (USCYBERCOM) in 2009. Resulted in a 14-month remediation effort called Operation Buckshot Yankee. The DoD subsequently banned removable media. Classified data from multiple theater commands was potentially compromised.',
    nation: 'Russia',
  },
  {
    id: 'stuxnet-2010',
    year: 2010,
    month: 6,
    title: 'Stuxnet — Operation Olympic Games',
    target: 'Natanz Nuclear Enrichment Facility, Iran',
    category: 'sabotage',
    severity: 'catastrophic',
    attackVector: 'USB Drive / Zero-Day Exploits (4)',
    description:
      'Stuxnet was the world\'s first known cyberweapon — a highly sophisticated worm designed to sabotage Iran\'s nuclear program. It exploited four zero-day Windows vulnerabilities and targeted Siemens S7-315 and S7-417 PLCs, causing uranium centrifuges to spin at destructive speeds while reporting normal operations to monitoring systems.',
    impact:
      "Destroyed approximately 1,000 of Iran's 5,000 uranium centrifuges, setting back Iran's nuclear program by 1-2 years. Marked a fundamental shift in warfare by demonstrating that cyberattacks could cause physical destruction. Developed jointly by US NSA and Israeli Unit 8200, revealed by Edward Snowden in 2013.",
    nation: 'USA/Israel',
  },
  {
    id: 'rsa-securid-2011',
    year: 2011,
    month: 3,
    title: 'RSA SecurID Breach',
    target: 'RSA Security (EMC)',
    category: 'espionage',
    severity: 'critical',
    attackVector: 'Spear Phishing / APT',
    description:
      'Chinese APT actors sent targeted spear-phishing emails with a malicious Flash zero-day embedded in an Excel spreadsheet titled "2011 Recruitment Plan.xls" to RSA employees. The attackers exfiltrated seed values and algorithms for the SecurID two-factor authentication tokens used by 40 million users worldwide.',
    impact:
      "Directly enabled subsequent attacks on Lockheed Martin, Northrop Grumman, and L-3 Communications — all major US defense contractors. RSA spent over $66 million on remediation and replaced customer tokens. Fundamentally undermined trust in hardware token 2FA systems across the defense industrial base.",
    nation: 'China',
  },
  {
    id: 'sony-psn-2011',
    year: 2011,
    month: 4,
    title: 'Sony PlayStation Network Breach',
    target: 'Sony PlayStation Network',
    category: 'datatheft',
    severity: 'critical',
    records: 77,
    attackVector: 'SQL Injection / Network Intrusion',
    description:
      'Hackers infiltrated the PlayStation Network and Qriocity services, stealing personal information from approximately 77 million accounts. The attack was discovered on April 19 but Sony waited 6 days before notifying users and took the network offline for 23 days. Credit card data for 12,000 users from an older database was also compromised.',
    impact:
      'PSN was offline for 23 days, costing Sony an estimated $171 million in direct costs including remediation, free PlayStation Plus subscriptions, and legal fees. Sony faced congressional hearings in the US over delayed disclosure. Multiple lawsuits settled for over $15 million. Became a landmark case in breach notification law.',
  },
  {
    id: 'shamoon-aramco-2012',
    year: 2012,
    month: 8,
    title: 'Shamoon — Saudi Aramco Attack',
    target: "Saudi Aramco / RasGas, Qatar",
    category: 'sabotage',
    severity: 'catastrophic',
    attackVector: 'Spear Phishing / Destructive Malware',
    description:
      'The Shamoon (DistTrack) malware wiped the master boot records and overwrote files with an image of a burning US flag on approximately 30,000 Saudi Aramco workstations. The attack, attributed to the Iranian Cutting Sword of Justice group, was designed purely to destroy — not to steal data — representing a new class of destructive cyberweapon.',
    impact:
      "30,000 of Aramco's 55,000 workstations were completely destroyed. The company reverted to typewriters and fax machines. Global oil production was unaffected due to isolated control systems. Considered one of the most destructive attacks on private infrastructure ever. Required months to fully recover.",
    nation: 'Iran',
  },
  {
    id: 'adobe-2013',
    year: 2013,
    month: 10,
    title: 'Adobe Systems Mega-Breach',
    target: 'Adobe Systems',
    category: 'datatheft',
    severity: 'critical',
    records: 153,
    attackVector: 'Network Intrusion / Database Exfiltration',
    description:
      'Attackers breached Adobe\'s network and stole 153 million user records including usernames, email addresses, and passwords encrypted with 3DES (a weak encryption mode) using the same encryption key for all records. The attackers also stole source code for Adobe Acrobat, ColdFusion, and other products.',
    impact:
      'Source code theft enabled attackers to discover vulnerabilities in Adobe products. Weak password encryption allowed mass password cracking. Revealed that 1.9 million users used "123456" as their password. Adobe settled a class action lawsuit for $1.1 million. The breach accelerated industry adoption of proper password hashing (bcrypt/scrypt).',
  },
  {
    id: 'target-2013',
    year: 2013,
    month: 12,
    title: 'Target Corporation Data Breach',
    target: 'Target Corporation',
    category: 'datatheft',
    severity: 'critical',
    records: 110,
    attackVector: 'Third-Party Vendor Compromise / POS Malware',
    description:
      "Attackers compromised Fazio Mechanical, Target's HVAC contractor, using a phishing email. Using the vendor's network credentials, they accessed Target's payment systems and installed BlackPOS malware on point-of-sale terminals across all 1,797 US stores during the 2013 holiday shopping season.",
    impact:
      '40 million payment card records and 70 million personal records stolen. Target CEO Gregg Steinhafel resigned. The company paid $292 million in total costs including a $18.5 million multi-state settlement and $39 million to banks. Permanently changed PCI DSS vendor security requirements and established vendor segmentation as a security standard.',
  },
  {
    id: 'sony-pictures-2014',
    year: 2014,
    month: 11,
    title: 'Sony Pictures Entertainment Hack',
    target: 'Sony Pictures Entertainment',
    category: 'sabotage',
    severity: 'catastrophic',
    attackVector: 'Destructive Malware / Social Engineering',
    description:
      "The Lazarus Group (North Korean state hackers) deployed the Destover wiper malware across Sony's network before leaking 100TB of data including unreleased films, executive emails, employee salary data, and Social Security numbers for 47,000 employees. The attack was retaliation for the film 'The Interview,' a comedy about a CIA plot to assassinate Kim Jong-un.",
    impact:
      "Sony suffered $35 million in immediate losses plus an estimated $100 million in total damages. Five unreleased films leaked online. Executive emails embarrassed Hollywood celebrities. Sony delayed then released The Interview via streaming. The US imposed new sanctions on North Korea and marked the first time the US government officially attributed a cyberattack to a nation-state.",
    nation: 'North Korea',
  },
  {
    id: 'jpmorgan-2014',
    year: 2014,
    month: 6,
    title: 'JPMorgan Chase Breach',
    target: 'JPMorgan Chase',
    category: 'datatheft',
    severity: 'critical',
    records: 83,
    attackVector: 'Stolen Credentials / Missing 2FA',
    description:
      "Attackers exploited a single server that had not been upgraded to two-factor authentication — one of over 90 servers they compromised in JPMorgan's network. The breach exposed contact information for 76 million households and 7 million small businesses but no financial data or Social Security numbers were taken.",
    impact:
      'Largest financial institution hack in US history at the time. Led to indictment of four individuals in a $100 million cybercrime ring that also targeted other financial institutions. Congress passed the Cybersecurity Information Sharing Act (CISA) partly in response. JPMorgan doubled its cybersecurity budget to $500 million annually.',
    nation: 'Russia',
  },
  {
    id: 'opm-2015',
    year: 2015,
    month: 6,
    title: 'OPM — US Federal Employee Breach',
    target: 'US Office of Personnel Management',
    category: 'espionage',
    severity: 'catastrophic',
    records: 22,
    attackVector: 'Supply Chain / Credential Theft / APT',
    description:
      "Chinese APT41 actors infiltrated the OPM via a contractor (KeyPoint Government Solutions) and stole 21.5 million security clearance background investigation files including SF-86 forms containing deeply personal information about federal employees, their families, and foreign contacts. Additionally, fingerprint data for 5.6 million people was stolen.",
    impact:
      "Called the 'largest theft of government data in US history' by Director of National Intelligence James Clapper. Exposed intelligence community personnel, overseas assets, and compromised ongoing counterintelligence operations. OPM Director Katherine Archuleta resigned. The FBI estimated the full intelligence damage may never be fully known. Led to complete overhaul of federal background investigation systems.",
    nation: 'China',
  },
  {
    id: 'bangladesh-bank-2016',
    year: 2016,
    month: 2,
    title: 'Bangladesh Bank SWIFT Heist',
    target: 'Bangladesh Bank / Federal Reserve',
    category: 'espionage',
    severity: 'catastrophic',
    attackVector: 'SWIFT Network / Custom Malware',
    description:
      "North Korea's Lazarus Group compromised Bangladesh Bank's SWIFT terminals using custom malware (evtdiag.exe) that deleted transaction records and disabled printer output. They sent 35 fraudulent transfer requests totaling $951 million through the Federal Reserve Bank of New York. A typo ('fandation' vs 'foundation') and a routing to a sanctioned entity raised flags that stopped most transfers.",
    impact:
      '$81 million successfully transferred to accounts in the Philippines before being withdrawn and laundered through casinos. Only $15 million was recovered. The attack exposed critical vulnerabilities in the SWIFT interbank messaging system used by 11,000 financial institutions. SWIFT subsequently mandated security controls for all member banks.',
    nation: 'North Korea',
  },
  {
    id: 'ukraine-power-2016',
    year: 2016,
    month: 12,
    title: "Ukraine Power Grid Attack (Industroyer)",
    target: "Ukraine's Power Transmission System / Ukrenergo",
    category: 'sabotage',
    severity: 'catastrophic',
    attackVector: 'Industroyer/Crashoverride ICS Malware',
    description:
      "Sandworm (Russian GRU Unit 74455) deployed the Industroyer (CrashOverride) malware against Ukraine's high-voltage electrical transmission operator Ukrenergo. The malware could directly control industrial control systems including circuit breakers and SCADA systems, and included a disk-wiping component to cover tracks.",
    impact:
      "One-fifth of Kyiv's power capacity was knocked out for approximately 75 minutes on December 17, 2016. The attack followed a similar attack in December 2015 that cut power to 225,000 customers. Together they constitute the first known cyberattacks to successfully take down power grids. Industroyer is considered the most dangerous ICS malware after Stuxnet.",
    nation: 'Russia',
  },
  {
    id: 'yahoo-2016',
    year: 2016,
    month: 9,
    title: 'Yahoo — 3 Billion Account Breach',
    target: 'Yahoo! Inc.',
    category: 'datatheft',
    severity: 'catastrophic',
    records: 3000,
    attackVector: 'Spear Phishing / Forged Authentication Cookies',
    description:
      "State-sponsored actors (initially from Russia) breached Yahoo in 2013 and 2014, stealing data from all 3 billion user accounts. The 2013 breach used MD5-hashed passwords with no salting. In 2016, Yahoo disclosed only the 500 million account 2014 breach; the full extent wasn't revealed until after Verizon's acquisition. A separate 2015-2016 attack used forged authentication cookies.",
    impact:
      "The largest data breach in history by record count. Verizon reduced its acquisition price by $350 million to $4.48 billion. Yahoo paid $85 million in class action settlement, $35 million SEC fine for delayed disclosure, and $80 million securities class action. Two Russian FSB officers and two hackers were indicted by the US DOJ.",
    nation: 'Russia',
  },
  {
    id: 'dnc-hack-2016',
    year: 2016,
    month: 3,
    title: 'US Election Interference — DNC Hack',
    target: 'DNC / Hillary Clinton Campaign / DCCC',
    category: 'espionage',
    severity: 'catastrophic',
    attackVector: 'Spear Phishing / APT28/APT29',
    description:
      "Russian intelligence agencies GRU (APT28/Fancy Bear) and FSB (APT29/Cozy Bear) infiltrated the Democratic National Committee, DCCC, and John Podesta's email via spear phishing. GRU used the Guccifer 2.0 persona and WikiLeaks to publish 19,252 emails and 8,034 attachments designed to maximize political impact before the 2016 US presidential election.",
    impact:
      "DNC Chair Debbie Wasserman Schultz resigned. Mueller investigation (Special Counsel) resulted in 25 Russian nationals and 3 entities being indicted. Influenced the 2016 US presidential election according to US intelligence consensus. Led to sanctions, diplomatic expulsions, and fundamental change in how democratic nations approach election security.",
    nation: 'Russia',
  },
  {
    id: 'wannacry-2017',
    year: 2017,
    month: 5,
    title: 'WannaCry Global Ransomware Attack',
    target: 'Global (150+ countries)',
    category: 'ransomware',
    severity: 'catastrophic',
    attackVector: 'EternalBlue SMB Exploit (NSA leaked)',
    description:
      "WannaCry ransomware weaponized EternalBlue — an NSA-developed exploit for SMBv1 leaked by Shadow Brokers — and spread autonomously across networks without user interaction. It encrypted files and demanded $300-600 in Bitcoin. Within 24 hours it had infected 230,000 computers in 150 countries. A kill switch discovered by Marcus Hutchins (@MalwareTech) slowed but didn't stop it.",
    impact:
      "UK National Health Service was devastated — thousands of appointments cancelled, ambulances diverted, systems offline for weeks. Nissan UK, Telefónica, FedEx, Deutsche Bahn, Chinese universities all hit. Total damages estimated at $4-8 billion. Attributed to North Korea's Lazarus Group. Accelerated global phase-out of Windows XP and unpatched systems.",
    nation: 'North Korea',
  },
  {
    id: 'notpetya-2017',
    year: 2017,
    month: 6,
    title: 'NotPetya — Most Destructive Cyberattack in History',
    target: 'Ukraine → Global Supply Chains',
    category: 'sabotage',
    severity: 'catastrophic',
    attackVector: 'Supply Chain (M.E.Doc) / EternalBlue / Credential Harvesting',
    description:
      "NotPetya (Sandworm/GRU) disguised as ransomware but was actually a pure wiper with no working decryption. It spread via the MeDoc Ukrainian accounting software update mechanism, then propagated using EternalBlue and the Mimikatz credential-harvesting tool. Unlike WannaCry, it had no kill switch and could spread even on patched systems via stolen credentials.",
    impact:
      "Caused $10 billion in damages — the most destructive and costly cyberattack in history. Maersk (shipping) lost $300M and had to reinstall 45,000 PCs and 4,000 servers in 10 days. Merck pharmaceutical lost $870M. FedEx/TNT lost $400M. Mondelez, Reckitt Benckiser, and Nuance all suffered hundreds of millions in losses. Ukraine bore the brunt with 10% of its computers destroyed.",
    nation: 'Russia',
  },
  {
    id: 'equifax-2017',
    year: 2017,
    month: 5,
    title: 'Equifax — 147 Million Consumer Records',
    target: 'Equifax Credit Bureau',
    category: 'datatheft',
    severity: 'catastrophic',
    records: 147,
    attackVector: 'Apache Struts CVE-2017-5638 Exploit',
    description:
      "Chinese state-sponsored hackers (APT10 / PLA Unit 54891) exploited an unpatched Apache Struts vulnerability (CVE-2017-5638) that had been public for 2 months. Over 76 days, they conducted 9,000 queries across 51 databases, exfiltrating Social Security numbers, birth dates, addresses, credit card numbers, and dispute documents for 147.9 million Americans.",
    impact:
      "$700 million FTC settlement (largest ever for a data breach). CEO, CTO, and CSO all resigned. $380 million minimum consumer restitution fund. The US DOJ indicted 4 members of the Chinese PLA. Called a 'profound failure' by the Senate Banking Committee. Prompted Congress to discuss mandatory data breach notification laws and credit freeze rights.",
    nation: 'China',
  },
  {
    id: 'marriott-2018',
    year: 2018,
    month: 11,
    title: 'Marriott/Starwood — 500 Million Guest Records',
    target: 'Marriott International / Starwood Hotels',
    category: 'espionage',
    severity: 'catastrophic',
    records: 500,
    attackVector: 'Supply Chain / Sustained APT Access',
    description:
      'Chinese intelligence (APT likely linked to MSS) had maintained persistent access to Starwood Hotels reservation system since 2014 — four years before discovery. Marriott acquired Starwood in 2016 without discovering the intrusion. Up to 500 million guest records were exposed including 327 million with full passport numbers, names, dates of birth, and payment card data.',
    impact:
      'GDPR fine of £18.4 million (reduced from initial £99 million). Class action lawsuits in multiple countries. Evidence suggested the goal was intelligence gathering on traveling government officials and business executives. Established the critical importance of security due diligence in mergers and acquisitions.',
    nation: 'China',
  },
  {
    id: 'cambridge-analytica-2018',
    year: 2018,
    month: 3,
    title: 'Cambridge Analytica / Facebook',
    target: 'Facebook / 87 Million Users',
    category: 'datatheft',
    severity: 'catastrophic',
    records: 87,
    attackVector: 'API Abuse / Third-Party App Data Harvesting',
    description:
      "Cambridge Analytica, a British political consulting firm, harvested the Facebook data of approximately 87 million users without consent via a personality quiz app (thisisyourdigitallife) that exploited Facebook's now-discontinued API to collect not just quiz takers' data but all their friends' data. The data was used to build psychographic profiles for targeted political advertising.",
    impact:
      "Facebook CEO Mark Zuckerberg testified before US Congress and European Parliament. Facebook fined $5 billion by FTC (largest ever against a tech company) and $644,000 by UK ICO. Cambridge Analytica dissolved. EU tightened GDPR enforcement. Led to fundamental changes in Facebook's developer API policies and sparked global debate on data privacy and election interference.",
  },
  {
    id: 'capital-one-2019',
    year: 2019,
    month: 7,
    title: 'Capital One Cloud Breach',
    target: 'Capital One Financial',
    category: 'datatheft',
    severity: 'critical',
    records: 106,
    attackVector: 'SSRF / Misconfigured AWS WAF',
    description:
      'Paige Thompson, a former AWS engineer, exploited a misconfigured Web Application Firewall to perform a Server-Side Request Forgery (SSRF) attack against Capital One\'s AWS EC2 metadata endpoint. This allowed her to obtain temporary credentials for an IAM role with excessive permissions, and exfiltrate data from over 700 S3 buckets.',
    impact:
      "106 million US and Canadian customers' personal information exposed including Social Security numbers for 140,000 customers and 80,000 bank account numbers. Capital One paid $190 million class action settlement and $80 million OCC fine. Thompson sentenced to probation. Became the defining case study for cloud security misconfigurations and least-privilege IAM policies.",
  },
  {
    id: 'citrix-apt-2019',
    year: 2019,
    month: 12,
    title: 'Citrix Systems APT Breach',
    target: 'Citrix Systems',
    category: 'espionage',
    severity: 'major',
    attackVector: 'Password Spraying / Credential Stuffing',
    description:
      'Iranian government-linked hackers (IRIDIUM / APT34) used password spraying — trying common passwords against many accounts — to breach Citrix\'s internal network. FBI warned Citrix in March 2019 but the full extent of the breach, discovered by Resecurity, wasn\'t disclosed until months later. At least 6 terabytes of sensitive technical and financial data were exfiltrated.',
    impact:
      "Business files and intellectual property potentially stolen. Citrix is used by 400,000 organizations including virtually all Fortune 500 companies and most government agencies. The breach raised serious concerns about supply chain security given Citrix's ubiquitous enterprise deployment. Led to emergency patching and architecture review across enterprise customers.",
    nation: 'Iran',
  },
  {
    id: 'solarwinds-2020',
    year: 2020,
    month: 12,
    title: 'SolarWinds SUNBURST — Supply Chain Espionage',
    target: '18,000 Organizations / US Government',
    category: 'espionage',
    severity: 'catastrophic',
    records: 18,
    attackVector: 'Supply Chain / Trojanized Software Update',
    description:
      "Russia's SVR (Cozy Bear/APT29) compromised SolarWinds' Orion build pipeline and inserted SUNBURST backdoor into legitimate software updates (versions 2019.4 through 2020.2.1). The malware lay dormant for 12-14 days, masqueraded as legitimate Orion traffic, and provided stealthy access to 18,000 organizations including US Treasury, Commerce, State, Homeland Security, and parts of the Pentagon.",
    impact:
      "Called 'the largest and most sophisticated attack the world has ever seen' by Microsoft President Brad Smith. Took 9 months to discover (FireEye noticed the breach during routine security audit). US Cyber Command, NSA, FBI, and CISA issued joint advisory. Sanctions on Russia. Prompted Executive Order 14028 on improving US cybersecurity. Cost to remediate estimated at $100 billion across affected organizations.",
    nation: 'Russia',
  },
  {
    id: 'twitter-hijack-2020',
    year: 2020,
    month: 7,
    title: 'Twitter VIP Account Hijacking',
    target: 'Twitter / High-Profile Accounts',
    category: 'datatheft',
    severity: 'major',
    attackVector: 'Social Engineering / Insider Threat',
    description:
      "Teenage hackers (OGUsers forum) used phone vishing to social-engineer Twitter employees into providing admin credentials to an internal support tool. They hijacked 130 high-profile accounts including Barack Obama, Joe Biden, Elon Musk, Bill Gates, Apple, Uber, and Kanye West to post Bitcoin scam tweets promising to double any cryptocurrency sent.",
    impact:
      'Over $100,000 in Bitcoin collected from scam before accounts were locked. Graham Clark (17), Mason Sheppard (19), and Nima Fazeli (22) arrested. Clark sentenced to 3 years. Exposed severe insider threat vulnerabilities at Twitter. SEC later charged Twitter for inadequate security controls. Entire Twitter platform briefly locked down — no verified accounts could tweet.',
  },
  {
    id: 'colonial-pipeline-2021',
    year: 2021,
    month: 5,
    title: 'Colonial Pipeline Ransomware',
    target: 'Colonial Pipeline Company',
    category: 'ransomware',
    severity: 'catastrophic',
    attackVector: 'Compromised VPN Credentials (Dark Web)',
    description:
      "DarkSide ransomware gang breached Colonial Pipeline via a legacy VPN account with a compromised password found on the dark web (no MFA was enabled). They exfiltrated 100GB of data and deployed ransomware on Colonial's IT network. Colonial shut down 5,500 miles of fuel pipeline — 45% of East Coast fuel supply — out of precaution while paying $4.4 million ransom.",
    impact:
      'Fuel shortages across 17 states and Washington D.C. for 6 days. Gas prices spiked. President Biden declared a state of emergency. The US DOJ tracked and recovered $2.3 million of the $4.4 million ransom payment. Led to Executive Order on cybersecurity for critical infrastructure. TSA issued first-ever mandatory cybersecurity regulations for pipeline operators.',
    nation: 'Russia',
  },
  {
    id: 'kaseya-vsa-2021',
    year: 2021,
    month: 7,
    title: 'Kaseya VSA Supply Chain Attack',
    target: '1,500 Downstream Businesses / MSPs',
    category: 'ransomware',
    severity: 'catastrophic',
    attackVector: 'Zero-Day in MSP Remote Management Software',
    description:
      "REvil ransomware group exploited an authentication bypass zero-day (CVE-2021-30116) in Kaseya VSA, a remote monitoring tool used by Managed Service Providers (MSPs). By attacking Kaseya, they simultaneously reached MSPs' downstream customers. On July 2, 2021 (US Independence Day weekend), REvil encrypted an estimated 1,500 organizations across 17 countries in the largest single ransomware event ever.",
    impact:
      "Swedish Coop supermarket chain closed all 800 stores for days. New Zealand schools taken offline. REvil demanded $70 million for universal decryption key. The Biden administration pressured Russia, leading REvil to mysteriously go offline. The FBI subsequently obtained the decryption key from an unnamed source. Illustrates the exponential reach of supply chain ransomware attacks.",
    nation: 'Russia',
  },
  {
    id: 'hafnium-exchange-2021',
    year: 2021,
    month: 1,
    title: 'Microsoft Exchange — Hafnium Zero-Days',
    target: '250,000+ Organizations Globally',
    category: 'espionage',
    severity: 'catastrophic',
    records: 250,
    attackVector: 'ProxyLogon / 4 Zero-Day Exploits',
    description:
      "Chinese state-sponsored APT Hafnium (PLA Unit 61398) exploited four critical zero-day vulnerabilities (ProxyLogon: CVE-2021-26855, CVE-2021-26857, CVE-2021-26858, CVE-2021-27065) in on-premises Microsoft Exchange Server. After initial disclosure on March 2, 2021, at least 10 different APT groups rushed to exploit vulnerable servers before patches could be applied.",
    impact:
      "Over 250,000 Exchange servers compromised globally within days. US State Department, US military, European Banking Authority, and thousands of private organizations affected. Web shells dropped for persistent access. Microsoft issued out-of-band emergency patches. US, EU, UK, and NATO jointly attributed the attack to China — a historic collective attribution. Led to indictment of 4 Chinese nationals.",
    nation: 'China',
  },
  {
    id: 't-mobile-2021',
    year: 2021,
    month: 8,
    title: 'T-Mobile Breach — 54 Million Records',
    target: 'T-Mobile US',
    category: 'datatheft',
    severity: 'critical',
    records: 54,
    attackVector: 'Brute Force / GPRS Gateway Exploitation',
    description:
      "21-year-old John Binns (a US citizen living in Turkey) used brute force tools to scan T-Mobile's internet-facing infrastructure, found an unprotected router, then pivated to access GPRS gateways. He exfiltrated data on 54 million current, former, and prospective customers including Social Security numbers, driver's license data, IMEI numbers, and account PINs.",
    impact:
      '$350 million class action settlement and $150 million promised for cybersecurity investment. T-Mobile agreed to sweeping security overhauls monitored by FTC. Binns arrested in Turkey in 2023 in connection with multiple telecom hacks for the Lapsus$ group. T-Mobile has suffered 5 significant breaches since 2018, raising questions about carrier data security.',
  },
  {
    id: 'facebook-leak-2021',
    year: 2021,
    month: 4,
    title: 'Facebook 533 Million User Data Leak',
    target: 'Facebook (Meta)',
    category: 'datatheft',
    severity: 'critical',
    records: 533,
    attackVector: 'Phone Number API Scraping (Pre-2019)',
    description:
      "Data from 533 million Facebook users across 106 countries was posted for free on a hacker forum. The data was scraped before 2019 by exploiting a vulnerability in the Contact Importer feature that allowed phone numbers to be used to look up Facebook profiles. The dataset included names, phone numbers, locations, bios, and email addresses.",
    impact:
      "Ireland's DPC (Facebook's EU regulator) fined Meta €265 million. The data was used in phishing and SIM swapping attacks. Facebook initially refused to notify affected users. The breach contributed to a broader EU crackdown on social media data practices. Illustrates the long tail of scraping attacks — data harvested years earlier can surface at any time.",
  },
  {
    id: 'uber-lapsus-2022',
    year: 2022,
    month: 9,
    title: 'Uber Breach — Lapsus$ Social Engineering',
    target: 'Uber Technologies',
    category: 'datatheft',
    severity: 'critical',
    attackVector: 'MFA Fatigue / Social Engineering',
    description:
      "An 18-year-old UK hacker (Lapsus$ group) purchased an Uber contractor's credentials from the dark web, then bombarded them with MFA push notifications until they approved one (MFA fatigue). He then found admin credentials hardcoded in a PowerShell script on an internal share, granting access to virtually all of Uber's internal systems including source code, Slack, HackerOne bug bounty reports, and AWS/GCP/Azure consoles.",
    impact:
      "Complete access to Uber's internal infrastructure for several hours. The attacker posted screenshots proving access to internal systems on Uber's own Slack. No financial data stolen but the full scope of system access was embarrassing. The 18-year-old was later arrested in the UK. The breach highlighted MFA fatigue attacks and the danger of hardcoded credentials in scripts.",
  },
  {
    id: 'lastpass-2022',
    year: 2022,
    month: 8,
    title: 'LastPass — Vault Data Stolen',
    target: 'LastPass Password Manager',
    category: 'datatheft',
    severity: 'catastrophic',
    attackVector: 'Developer Workstation Compromise / Cloud Storage Access',
    description:
      "In a two-stage attack, hackers first breached LastPass in August 2022 stealing source code and technical documentation. They used that information to target a senior DevOps engineer's home computer with a Plex media server vulnerability, installing a keylogger to steal master password credentials. This granted access to LastPass's AWS cloud storage containing encrypted customer vault backups.",
    impact:
      "Complete encrypted vault backups for millions of customers stolen, including all stored passwords encrypted with each user's master password. Attackers began targeting high-value vault holders with phishing to obtain master passwords. Several cryptocurrency holders reported losing millions in assets from compromised vaults. LastPass's handling of the disclosure was widely criticized as opaque and misleading.",
  },
  {
    id: 'ronin-network-2022',
    year: 2022,
    month: 3,
    title: 'Ronin Network — $625 Million Crypto Theft',
    target: 'Ronin Network (Axie Infinity)',
    category: 'espionage',
    severity: 'catastrophic',
    attackVector: 'Social Engineering / Compromised Validator Keys',
    description:
      "North Korea's Lazarus Group sent fake LinkedIn job offers to Axie Infinity engineers. After a senior employee downloaded a trojanized PDF job offer, attackers gained access to their system and ultimately to 4 of 9 Ronin validator private keys, plus access to a fifth via Axie DAO validator. With 5/9 keys, they approved two fraudulent transactions draining $625 million in ETH and USDC.",
    impact:
      "At the time, the largest DeFi and cryptocurrency theft in history. Sky Mavis (Axie Infinity developer) had to pause withdrawals for 6 days before the breach was even discovered. US Treasury sanctioned the Ethereum address used. Lazarus Group identified as perpetrators. Raised fundamental questions about security of proof-of-authority blockchain networks with small validator sets.",
    nation: 'North Korea',
  },
  {
    id: 'costa-rica-conti-2022',
    year: 2022,
    month: 4,
    title: 'Costa Rica Government — Conti Ransomware',
    target: 'Costa Rica Government (27 Agencies)',
    category: 'ransomware',
    severity: 'catastrophic',
    attackVector: 'Phishing / RDP Exploitation',
    description:
      "Conti ransomware group attacked 27 Costa Rican government institutions including the Finance Ministry, which was crippled during tax season. Costa Rica became the first country to officially declare a national emergency over a ransomware attack. A second attack by HIVE ransomware targeting the Costa Rican Social Security Fund followed weeks later.",
    impact:
      "Costa Rica declared national emergency under new president Rodrigo Chaves. $30 million in losses from disrupted import/export operations alone. Tax collection systems offline for weeks. The US offered $15 million bounty for information on Conti leaders. The attack marked ransomware groups' escalation to direct attacks on national governments, not just individual organizations.",
    nation: 'Russia',
  },
  {
    id: 'moveit-2023',
    year: 2023,
    month: 5,
    title: 'MOVEit — Mass Exploitation (2,500+ Orgs)',
    target: '2,500+ Organizations Globally',
    category: 'datatheft',
    severity: 'catastrophic',
    records: 95,
    attackVector: 'SQL Injection Zero-Day (CVE-2023-34362)',
    description:
      "Cl0p ransomware gang (linked to Russia) exploited a SQL injection zero-day in Progress Software's MOVEit Transfer file transfer application. Using this single vulnerability, they simultaneously breached 2,500+ organizations that used MOVEit for managed file transfers, including Shell, BBC, British Airways, Boots, Aer Lingus, and numerous US government agencies (though data was not publicly released for government entities).",
    impact:
      "95+ million individuals affected. US CISA, UK NCSC, and government agencies of multiple countries affected. Shell, Siemens Energy, and major accounting firms impacted. Cl0p extorted victims by threatening to publish data on their leak site. Total damages estimated at $9.9 billion. Demonstrated the devastating efficiency of targeting widely-used managed file transfer software.",
    nation: 'Russia',
  },
  {
    id: 'mgm-resorts-2023',
    year: 2023,
    month: 9,
    title: 'MGM Resorts — $100M Ransomware',
    target: 'MGM Resorts International',
    category: 'ransomware',
    severity: 'catastrophic',
    attackVector: 'Vishing / Social Engineering via LinkedIn + Okta',
    description:
      "Scattered Spider (0ktapus) hackers found an MGM employee on LinkedIn, called the IT help desk impersonating them, and convinced the operator to reset their Okta MFA — a 10-minute social engineering call. This gave them access to MGM's Okta environment, which they used to deploy ALPHV/BlackCat ransomware. MGM refused to pay the ransom.",
    impact:
      "$100 million in losses from 9 days of disruption. Casino slot machines locked. Hotel key cards inoperative. Reservations systems down. Guest data including SSNs and passport numbers for 37 million customers stolen. MGM CISO testified before US Senate. Caesars Entertainment paid $15 million ransom to Scattered Spider in the same campaign. Total cost including regulatory investigation exceeded $144 million.",
  },
  {
    id: '23andme-2023',
    year: 2023,
    month: 10,
    title: '23andMe — 6.9 Million Genetic Profiles',
    target: '23andMe',
    category: 'datatheft',
    severity: 'critical',
    records: 7,
    attackVector: 'Credential Stuffing + DNA Relatives Feature Abuse',
    description:
      "Hackers used credential stuffing (reusing passwords leaked in other breaches) to access 14,000 23andMe accounts, then abused the DNA Relatives opt-in feature to scrape data from the profiles of 6.9 million connected users — nearly half of all 23andMe customers. The stolen data included genetic ancestry compositions, phenotype data, and family tree information.",
    impact:
      "Genetic data for 6.9 million people exposed — a uniquely sensitive category as DNA cannot be changed. The data was offered for sale segmented by ethnicity, including listings specifically targeting Jewish and Chinese users. 23andMe initially blamed users for reusing passwords. Company agreed to $30 million class action settlement. Filed for bankruptcy in 2025, raising questions about what happens to genetic data.",
  },
  {
    id: 'change-healthcare-2024',
    year: 2024,
    month: 2,
    title: 'Change Healthcare — $22M Ransom, US Healthcare Crisis',
    target: 'Change Healthcare (UnitedHealth Group)',
    category: 'ransomware',
    severity: 'catastrophic',
    records: 190,
    attackVector: 'Stolen Credentials / No MFA on Citrix Portal',
    description:
      "ALPHV/BlackCat ransomware gang accessed Change Healthcare's Citrix remote access portal using stolen credentials — there was no MFA. Change Healthcare processes 15 billion healthcare transactions annually for 900,000 physicians, 33,000 pharmacies, 5,500 hospitals. Encryption of systems caused a nationwide healthcare payment processing outage lasting weeks, blocking prescription fulfillment and claims processing.",
    impact:
      "UnitedHealth paid $22 million ransom. Approximately 190 million Americans had health data exposed — the largest US healthcare breach ever. Pharmacies couldn't process prescriptions. Hospitals couldn't verify insurance. Rural hospitals faced financial crisis from unpaid claims. UnitedHealth spent $3.1 billion on recovery. CEO Andrew Witty testified before Congress. Exposed catastrophic single-point-of-failure in US healthcare infrastructure.",
  },
  {
    id: 'att-2024',
    year: 2024,
    month: 3,
    title: "AT&T — 73 Million Customer Records",
    target: 'AT&T',
    category: 'datatheft',
    severity: 'catastrophic',
    records: 73,
    attackVector: 'Third-Party Data Breach / Snowflake Account Compromise',
    description:
      "AT&T suffered two major incidents in 2024. First, a dataset containing account information for 73 million current and former customers (including encrypted Social Security numbers) was published on the dark web — data AT&T initially denied owning, traced to a 2021 breach of a third-party vendor. Second, in July 2024, call and text metadata for nearly all AT&T cellular customers from May-October 2022 was stolen from Snowflake cloud storage.",
    impact:
      "73 million SSNs and account data exposed in the first incident. Passcodes for current customers reset. In the second incident, call records for virtually all 110 million AT&T customers over a 6-month period were stolen including cell site data allowing location tracking. The FBI delayed public disclosure twice citing national security. Led to civil suits and FCC investigation.",
  },
  {
    id: 'snowflake-2024',
    year: 2024,
    month: 5,
    title: 'Snowflake Customer Breaches — Ticketmaster, Santander',
    target: 'Snowflake Customers (165+ Organizations)',
    category: 'datatheft',
    severity: 'catastrophic',
    records: 560,
    attackVector: 'Credential Theft / Infostealer Malware / No MFA',
    description:
      "UNC5537 (linked to Scattered Spider) used infostealer malware to harvest Snowflake login credentials from infected personal computers of customer employees. Since Snowflake's single-factor authentication allowed login with just credentials, attackers accessed 165+ customer Snowflake tenants including Ticketmaster (560M records), Santander Bank, LendingTree/QuoteWizard, Advance Auto Parts, and AT&T.",
    impact:
      "560 million Ticketmaster customer records stolen. Santander customer and employee data exposed. Total across all victims: hundreds of millions of records. Snowflake faced intense scrutiny for not requiring MFA by default. Mandiant/CrowdStrike led response. Two suspects arrested in Canada and Turkey. Snowflake subsequently mandated MFA for all new accounts. Exposed risks of SaaS data warehouse security.",
  },
  {
    id: 'turkey-voter-leak-2016',
    year: 2016,
    month: 4,
    title: 'Türkiye Seçmen Kayıt Veri Sızıntısı',
    target: 'Türkiye İçişleri Bakanlığı / MERNİS',
    category: 'datatheft',
    severity: 'catastrophic',
    attackVector: 'Database Exfiltration',
    description:
      '50 milyondan fazla Türk vatandaşının kişisel verisi (TC kimlik numarası, ad-soyad, doğum tarihi, adres, anne-baba adı) bir torrent dosyası aracılığıyla internete sızdırıldı. Türkiye\'nin nüfusunun yaklaşık %65\'ini kapsayan bu sızıntı, Doğu Avrupa merkezli aktörler tarafından gerçekleştirildiği değerlendirildi. Veriler MERNİS nüfus kayıt sisteminden elde edildi.',
    impact:
      'Türkiye\'nin en büyük veri ihlali olarak kayıtlara geçti. 50 milyonun üzerinde vatandaş kimlik hırsızlığı ve dolandırıcılık riskiyle karşı karşıya kaldı. Olayın ardından Kişisel Verilerin Korunması Kanunu (KVKK) 2016\'da yasalaştı. Kamu kurumlarında siber güvenlik bütçeleri önemli ölçüde artırıldı.',
    nation: 'Turkey',
  },
  {
    id: 'tbmm-redhack-2015',
    year: 2015,
    month: 5,
    title: 'TBMM RedHack Hacktivizm Saldırısı',
    target: 'Türkiye Büyük Millet Meclisi / Bakanlıklar',
    category: 'hacktivism',
    severity: 'critical',
    attackVector: 'Spear Phishing / SQL Injection',
    description:
      'Sol görüşlü hacktivist grup RedHack, Türkiye Büyük Millet Meclisi ve birden fazla bakanlığın ağ altyapısına sızarak iç yazışmaları, gizli belgeler ve kişisel verileri ele geçirdi. Grup, elde ettiği materyalleri kamuoyuyla paylaştı ve bu durum ciddi güvenlik açıklarını gün yüzüne çıkardı.',
    impact:
      'Bakanlıklar arası gizli yazışmalar ifşa oldu. Çok sayıda üst düzey yetkili hakkında soruşturma başlatıldı. Türk Silahlı Kuvvetleri ve kamu kurumları siber güvenlik protokollerini kapsamlı biçimde revize etti. RedHack üyeleri çeşitli davalarla yargılandı.',
    nation: 'Turkey',
  },
  {
    id: 'apt28-turkey-2016',
    year: 2016,
    month: 10,
    title: 'APT28 Türk Hükümeti Hedefli Operasyon',
    target: 'Türk Hükümeti Yetkilileri / AKP',
    category: 'espionage',
    severity: 'critical',
    attackVector: 'Spear Phishing / Watering Hole',
    description:
      'Rus devlet destekli APT28 (Fancy Bear) grubu, Türk hükümeti yetkililerini ve Adalet ve Kalkınma Partisi üyelerini hedef alan kapsamlı bir spear-phishing kampanyası başlattı. Özellikle Türkiye-Rusya ilişkilerinin gerginleştiği F-16 düşürme krizi sonrasındaki dönemde yoğunlaşan operasyonla binlerce e-posta ve belge elde edildi.',
    impact:
      'Üst düzey hükümet yazışmaları ve diplomatik belgeler Wikileaks üzerinden yayımlandı. Türk-Rus ilişkilerindeki derin gerginliğin siber alana yansıması olarak tarihe geçti. Türkiye\'nin kurumsal e-posta güvenliği ve şifreleme politikaları gözden geçirildi.',
    nation: 'Russia',
  },
  {
    id: 'turkey-telecom-bgp-2022',
    year: 2022,
    month: 3,
    title: 'Türk Telekom BGP Hijack & Altyapı Saldırısı',
    target: 'Türk Telekom / Türk İnternet Altyapısı',
    category: 'sabotage',
    severity: 'critical',
    attackVector: 'BGP Route Hijacking / DDoS',
    description:
      'Ukrayna Savaşı\'nın tırmandığı dönemde Türkiye\'nin kritik internet altyapısı birden fazla koordineli saldırıya maruz kaldı. Anonymous ve pro-Rus grupların ortak hedefi haline gelen Türk Telekom altyapısına yönelik BGP yönlendirme manipülasyonu ve yoğun DDoS saldırıları gerçekleştirildi.',
    impact:
      'Türkiye\'nin NATO ile ağ bağlantısında kısa süreli kesintiler yaşandı. Bankacılık ve devlet hizmetleri geçici olarak etkilendi. BTK acil protokolleri devreye alarak trafiği yönlendirdi. Olay, Türkiye\'nin kritik altyapı güvenliği yatırımlarını hızlandırdı.',
    nation: 'Turkey',
  },
  {
    id: 'turkey-edevlet-phishing-2023',
    year: 2023,
    month: 6,
    title: 'E-Devlet Kimlik Avı Kampanyası',
    target: 'Türk Vatandaşları / e-Devlet Kapısı',
    category: 'datatheft',
    severity: 'major',
    attackVector: 'Phishing / Social Engineering',
    description:
      'Organize suç örgütleri, Türkiye\'nin e-Devlet portalını taklit eden sahte web siteleri ve SMS kampanyaları aracılığıyla milyonlarca vatandaşı hedef aldı. Doğrulama kodu çalma yöntemiyle hesaplara erişim sağlanarak çeşitli mali dolandırıcılık işlemleri gerçekleştirildi.',
    impact:
      '3,5 milyon e-Devlet hesabına yetkisiz erişim girişimi tespit edildi. Yüz binlerce vatandaş mali kayıp yaşadı. BTK ve Emniyet Genel Müdürlüğü Siber Suçlarla Mücadele birimi kapsamlı bir operasyon yürüttü. e-Devlet iki faktörlü kimlik doğrulamayı zorunlu hale getirdi.',
    nation: 'Turkey',
  },
];
