export default `# VC Lookup Service Documentation

      The VC Lookup Service is responsible for managing the rules of admissibility for VC tokens and handling queries related to them.

      ## Example
      \`\`\`typescript
      const vcService = new VCLookupService()
      const answer = await vcService.lookup({
        query: { outpoint: 'txid.vout' },
        service: 'ls_vc'
      })
      console.log(answer)
      \`\`\``
