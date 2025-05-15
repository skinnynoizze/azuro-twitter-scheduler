// azuro.ts
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

// Types (previously imported from "../types")
export interface Game {
    startsAt: string;
    participants: {
        name: string;
    }[];
    sport: {
        slug: string;
    };
    league: {
        slug: string;
        country: {
            slug: string;
        };
    };
}

export interface TweetData {
    text: string;
    sportSlug: string;
    countrySlug: string;
    leagueSlug: string;
    leagueId: string;
    games: Game[];
    attachments: {
        url: string;
        contentType: string;
    }[];
}

export interface GraphQLResponse {
    data: {
        games: Game[];
    };
}

// Utility functions (previously imported from "../utils")
export const round = (num: number, precision: number): number => {
    const factor = Math.pow(10, precision);
    return Math.round(num * factor) / factor;
};

export const safeAPICall = async (
    name: string,
    method: 'get' | 'post',
    url: string,
    body: any,
    headers: any = null,
    maxRetries: number = 3,
    retryDelay: number = 1000,
    defaultValue: any = null,
    throwOnError: boolean = false
): Promise<any> => {
    let retries = 0;
    while (retries <= maxRetries) {
        try {
            const requestOptions: RequestInit = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: method === 'post' ? JSON.stringify(body) : undefined
            };

            const response = await fetch(url, requestOptions);
            
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            retries++;
            logger.error(`API call to ${name} failed (attempt ${retries}/${maxRetries + 1})`, error);
            
            if (retries > maxRetries) {
                if (throwOnError) {
                    throw error;
                }
                logger.error(`Max retries reached for ${name}, returning default value`);
                return defaultValue;
            }
            
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
};

// League title formats
const leagueTitles = {
    NHL: [
        "NHL MATCHDAY TODAY! 🏒",
        "HOCKEY FANS, IT'S GAME DAY! 🏒",
        "NHL MATCHDAY! 🏒",
        "TONIGHT'S #NHL ACTION 🏒",
        "#NHL TONIGHT! 🏒"
    ],
    NBA: [
        "NBA TONIGHT! 🏀",
        "#NBA ACTION TONIGHT! 🏀",
        "NBA MATCHDAY TODAY! 🏀",
        "NBA GAMEDAY! 🏀",
        "NBA ACTION TONIGHT! 🏀",
        "TONIGHT'S NBA LINEUP 🏀",
        "NBA MATCH DAY ALERT! 🏀"
    ],
    MLB: [
        "GET READY FOR #MLB ACTION! ⚾",
        "#MLB GAME DAY ALERT! ⚾️",
        "SEASON BASEBALL ACTION! ⚾",
        "MLB GAME DAY ALERT! ⚾️",
        "BASEBALL GAMEDAY ACROSS AMERICA! ⚾"
    ],
    EPL: [
        "PREMIER LEAGUE ACTION! ⚽",
        "EPL MATCHDAY TODAY! ⚽",
        "EPL GAMEDAY! ⚽",
        "EPL ACTION TODAY! ⚽",
        "TODAY'S EPL LINEUP ⚽"
    ]
};

// Function to determine if a date is in BST period (British Summer Time)
const isInBST = (date: Date = new Date()): boolean => {
    // BST runs from last Sunday in March to last Sunday in October
    const year = date.getFullYear();
    
    // Create last Sunday in March
    const marchLastDay = new Date(year, 2, 31);
    marchLastDay.setDate(marchLastDay.getDate() - marchLastDay.getDay());
    
    // Create last Sunday in October
    const octoberLastDay = new Date(year, 9, 31);
    octoberLastDay.setDate(octoberLastDay.getDate() - octoberLastDay.getDay());
    
    // Check if date is between these two dates (inclusive of start, exclusive of end)
    return date >= marchLastDay && date < octoberLastDay;
};

export const leagues = {
    NHL: {
        leagueId: "32_United States_NHL",
        timeZones: [
            ["America/New_York", "ET"],
            ["America/Los_Angeles", "PT"]
        ],
        emoji: "🏒",
        image: "NHL_GAMEDAY.png"
    },
    NBA: {
        leagueId: "31_United States_NBA",
        timeZones: [
          ["America/New_York", "ET"],
          ["America/Los_Angeles", "PT"]
        ],
        emoji: "🏀",
        image: "NBA_GAMEDAY.png"
    },
    MLB: {
        leagueId: "28_United States_MLB",
        timeZones: [
            ["America/New_York", "ET"],
            ["America/Los_Angeles", "PT"]
        ],
        emoji: "⚾",
        image: "MLB_GAMEDAY.png"
    },
    EPL: {
        leagueId: "33_England_Premier League",
        timeZones: [
            ["Europe/London", isInBST() ? "BST" : "GMT"]
        ],
        emoji: "⚽",
        image: "EPL_GAMEDAY.png"
    }
};

// Function to convert Unix timestamp to specified timezone
const convertUnixTimeToZone = (timestamp: number, timeZone: [string, string]) => {
    const date = new Date(timestamp * 1000);
    
    // If this is EPL game time, determine the correct timezone label
    let tzLabel = timeZone[1];
    if (timeZone[0] === "Europe/London") {
        tzLabel = isInBST(date) ? "BST" : "GMT";
    }
    
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timeZone[0],
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    });
    return `${formatter.format(date)} ${tzLabel}`;
};

async function getLeagueEvents(leagueId: string): Promise<Game[]> {
    const startTime = round(Date.now()/1000, 0);
    const endTime = round(Date.now()/1000 + 18*60*60, 0); // 18 hours

    // Construct the query inside the games {...} block, not as a complete query
    const queryContent = `
        games(
            orderBy: startsAt, 
            orderDirection: asc,
            where: {
                league: "${leagueId}",
                startsAt_gt: ${startTime},
                startsAt_lt: ${endTime}
            }
        ) {
            startsAt
            participants {
                name
            }
            sport {
                slug
            }
            league {
                slug
                country {
                    slug
                }
            }
        }
    `;

    // Fix the query formatting to be valid GraphQL
    const response = await safeAPICall(
        "get league games",
        'post',
        "https://thegraph-1.onchainfeed.org/subgraphs/name/azuro-protocol/azuro-data-feed-polygon",
        { query: `query Games { ${queryContent} }` },
        null,
        3,
        1000,
        { data: { games: [] } },
        false
    ) as GraphQLResponse;

    return response.data.games;
}

// Simplified version of azuroProvider that doesn't depend on ElizaOS
export class AzuroProvider {
    // Get games for specific league or all leagues
    async getGames(leagueId?: string): Promise<{ tweets: TweetData[] }> {
        try {
            logger.info('AZURO: Fetching games', {
                leagueId: leagueId || 'all leagues'
            });

            // If leagueId is provided, only fetch that league
            let leaguesToFetch: string[];
            if (leagueId) {
                const found = Object.entries(leagues).find(([_, config]) => config.leagueId === leagueId);
                leaguesToFetch = found && found[0] ? [found[0]] : [];
            } else {
                leaguesToFetch = Object.keys(leagues);
            }

            const results = await Promise.all(
                leaguesToFetch.map(async (league: string) => {
                    if (!(league in leagues)) return { league, events: [] };
                    const leagueKey = league as keyof typeof leagues;
                    const events = await getLeagueEvents(leagues[leagueKey].leagueId);
                    if (events.length > 0) {
                        logger.info(`AZURO: Found ${events.length} games for ${league}`);
                        logger.info(`AZURO: Games for ${league}:\n`, JSON.stringify(events, null, 2));
                    }
                    return { league, events };
                })
            );

            // Filter leagues with games and format them
            const leaguesWithGames = results.filter(({ events }) => events.length > 0);
            
            if (leaguesWithGames.length === 0) {
                logger.info('AZURO: No games found');
                return { tweets: [] };
            }

            // Format each league separately
            const tweets: TweetData[] = leaguesWithGames.map(({ league, events }) => {
                if (!(league in leagues)) return null as any; // Should not happen, but for type safety
                const leagueKey = league as keyof typeof leagues;
                const leagueInfo = leagues[leagueKey];
                
                // Sort events by start time and take only first 5
                events.sort((a, b) => Number(a.startsAt) - Number(b.startsAt));
                
                // Get a random title for this league
                const titleOptions = leagueTitles[league as keyof typeof leagueTitles];
                const randomTitle = titleOptions[Math.floor(Math.random() * titleOptions.length)];
                
                let output = `${randomTitle}\n\n`;

                // Group events by start time
                const timeGroups: { [key: string]: Game[] } = {};
                events.forEach(event => {
                    if (!(event.startsAt in timeGroups)) {
                        timeGroups[event.startsAt] = [];
                    }
                    timeGroups[event.startsAt].push(event);
                });

                // Format each time group
                const timeGroupEntries = Object.entries(timeGroups);
                timeGroupEntries.forEach(([time, groupEvents], index) => {
                    // Use all configured timezones for this league
                    const timeStrings = (leagueInfo.timeZones as [string, string][]).map((timezone) => 
                        convertUnixTimeToZone(Number(time), timezone)
                    );
                    
                    // Join all timezones with " / " to prevent Twitter from auto-linking
                    const timeStr = timeStrings.join(" / ");
                    output += `${timeStr}\n`;
                    
                    // Format each game with team names
                    (groupEvents as Game[]).forEach(event => {
                        // Use "vs" for EPL games, "@" for others
                        const separator = league === "EPL" ? "vs" : "@";
                        output += `- ${event.participants[0].name} ${separator} ${event.participants[1].name}\n`;
                    });
                    
                    // Add an extra line break between time groups (except after the last group)
                    if (index < timeGroupEntries.length - 1) {
                        output += "\n";
                    }
                });

                // Get the first game for this league's betting links
                const firstGame = events[0];

                // Check if league image exists using absolute path
                const imagePath = path.join(process.cwd(), 'assets', leagueInfo.image);
                logger.info('Checking image path:', {
                    path: imagePath,
                    exists: fs.existsSync(imagePath),
                    league: league,
                    image: leagueInfo.image
                });
                
                const attachments = fs.existsSync(imagePath) ? [{
                    url: imagePath,
                    contentType: 'image/png'
                }] : [];

                logger.info('Tweet attachments:', {
                    hasAttachments: attachments.length > 0,
                    attachments: attachments
                });

                return {
                    text: output,
                    sportSlug: firstGame.sport.slug,
                    countrySlug: firstGame.league.country.slug,
                    leagueSlug: firstGame.league.slug,
                    leagueId: leagueInfo.leagueId,
                    games: events,
                    attachments
                };
            }).filter(Boolean);

            logger.info('AZURO: Generated tweets', {
                leagueCount: tweets.length,
                leagues: leaguesWithGames.map(lg => lg.league)
            });

            return { tweets };

        } catch (error: any) {
            logger.error('AZURO: Error fetching games', {
                error: error.message
            });
            return { tweets: [] };
        }
    }
}

export const azuroProvider = new AzuroProvider();