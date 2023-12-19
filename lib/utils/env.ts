export function stageAndRegion() {
    const [stage, region = 'eu-1'] = process.env.ENV?.split(':') || []
    return [stage, region]
}